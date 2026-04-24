/**
 * Log Image Meal Workflow
 *
 * Deterministic 2-step flow:
 *   1. analyze-image  — calls DETIC to detect foods and find catalog matches
 *   2. log-meal       — picks the best catalog match per detected food and logs the meal
 *
 * Auth note: userId and authToken are passed explicitly in the input schema.
 * Do NOT rely on asyncContext inside workflow steps.
 */

import { createStep, Workflow } from "@mastra/core/workflows";
import { z } from "zod";
import { analyzeImageWithDetic, logMeal } from "../clients/catalog-client";
import { logger } from "../../utils/logger";

// ──────────────────────────────────────────────────────────────────────────────
// Schemas
// ──────────────────────────────────────────────────────────────────────────────

const workflowInputSchema = z.object({
  image_base64: z.string().min(100).describe("Imagem em base64 (com ou sem prefixo data:image)"),
  meal_type: z.enum(["breakfast", "lunch", "dinner", "snack"]).describe("Tipo de refeição"),
  top_k_per_food: z.number().int().min(1).max(10).default(3).describe("Matches do catálogo por alimento"),
  confidence_threshold: z.number().min(0.1).max(1.0).default(0.5).describe("Threshold de confiança DETIC (0-1)"),
  notes: z.string().optional().describe("Notas sobre a refeição"),
  userId: z.string().describe("ID do usuário autenticado"),
  authToken: z.string().describe("JWT Bearer token"),
});

const catalogMatchSchema = z.object({
  detected_name: z.string(),
  matches: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      similarity: z.number(),
      serving_size_g: z.number(),
    }),
  ),
});

const imageAnalysisIntermediateSchema = z.object({
  meal_type: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  notes: z.string().optional(),
  userId: z.string(),
  authToken: z.string(),
  detected_foods: z.array(z.string()),
  catalog_matches: z.array(catalogMatchSchema),
  total_detected: z.number(),
});

const mealLogOutputSchema = z.object({
  meal_log_id: z.string(),
  meal_type: z.string(),
  total_calories: z.number(),
  total_protein_g: z.number(),
  total_carbs_g: z.number(),
  total_fat_g: z.number(),
  foods_logged: z.number(),
  catalog_matches_used: z.array(
    z.object({
      detected_name: z.string(),
      catalog_food_name: z.string(),
      similarity: z.number(),
      quantity_g: z.number(),
    }),
  ),
  message: z.string(),
});

// ──────────────────────────────────────────────────────────────────────────────
// Step 1 — Analyze image with DETIC
// ──────────────────────────────────────────────────────────────────────────────

const analyzeImageStep = createStep({
  id: "analyze-image",
  description: "Analyzes the food image using DETIC and finds catalog matches",
  inputSchema: workflowInputSchema,
  outputSchema: imageAnalysisIntermediateSchema,
  execute: async ({ inputData }) => {
    const {
      image_base64,
      meal_type,
      top_k_per_food,
      confidence_threshold,
      notes,
      userId,
      authToken,
    } = inputData;

    logger.info(
      `[Workflow:logImageMeal] Step 1 — analyzing image with DETIC (user ${userId})`,
    );

    const result = await analyzeImageWithDetic(
      { image: image_base64, top_k_per_food, confidence_threshold },
      undefined,
      authToken,
    );

    if (!result.success || result.total_detected === 0) {
      throw new Error(
        result.message ?? "Nenhum alimento detectado na imagem. Tente com uma imagem mais clara.",
      );
    }

    logger.info(
      `[Workflow:logImageMeal] Step 1 ✅ — ${result.total_detected} alimento(s) detectado(s)`,
    );

    return {
      meal_type,
      notes,
      userId,
      authToken,
      detected_foods: result.detected_foods,
      catalog_matches: result.catalog_matches.map((m) => ({
        detected_name: m.detected_name,
        matches: m.matches.map((match) => ({
          id: match.id,
          name: match.name,
          similarity: match.similarity,
          serving_size_g: match.serving_size_g,
        })),
      })),
      total_detected: result.total_detected,
    };
  },
});

// ──────────────────────────────────────────────────────────────────────────────
// Step 2 — Log the meal using catalog matches
// ──────────────────────────────────────────────────────────────────────────────

const logMealStep = createStep({
  id: "log-meal",
  description: "Picks the best catalog match per detected food and logs the meal",
  inputSchema: imageAnalysisIntermediateSchema,
  outputSchema: mealLogOutputSchema,
  execute: async ({ inputData }) => {
    const { meal_type, notes, userId, authToken, catalog_matches } = inputData;

    logger.info(
      `[Workflow:logImageMeal] Step 2 — logging meal for user ${userId} (${catalog_matches.length} match group(s))`,
    );

    const foodsToLog: Array<{ food_id: string; quantity_g: number; name: string }> = [];
    const catalogMatchesUsed: Array<{
      detected_name: string;
      catalog_food_name: string;
      similarity: number;
      quantity_g: number;
    }> = [];

    for (const group of catalog_matches) {
      if (group.matches.length === 0) {
        logger.warn(`[Workflow:logImageMeal] No catalog match for "${group.detected_name}" — skipping`);
        continue;
      }

      // matches are already sorted by similarity desc from the API
      const best = group.matches[0];
      const quantity_g = best.serving_size_g > 0 ? best.serving_size_g : 100;

      foodsToLog.push({ food_id: best.id, quantity_g, name: best.name });
      catalogMatchesUsed.push({
        detected_name: group.detected_name,
        catalog_food_name: best.name,
        similarity: best.similarity,
        quantity_g,
      });
    }

    if (foodsToLog.length === 0) {
      throw new Error(
        "Nenhum alimento correspondente encontrado no catálogo. Verifique a imagem e tente novamente.",
      );
    }

    const mealLog = await logMeal(
      {
        user_id: userId,
        meal_type,
        foods: foodsToLog,
        notes: notes ?? "Registrado via análise de imagem",
      },
      undefined,
      authToken,
    );

    logger.info(
      `[Workflow:logImageMeal] Step 2 ✅ — meal logged: ${mealLog.id} (${mealLog.total_calories} kcal)`,
    );

    return {
      meal_log_id: mealLog.id,
      meal_type: mealLog.meal_type,
      total_calories: mealLog.total_calories,
      total_protein_g: mealLog.total_protein_g,
      total_carbs_g: mealLog.total_carbs_g,
      total_fat_g: mealLog.total_fat_g,
      foods_logged: foodsToLog.length,
      catalog_matches_used: catalogMatchesUsed,
      message:
        `Refeição registrada com ${foodsToLog.length} alimento(s). ` +
        `Total: ${mealLog.total_calories} kcal · ` +
        `Proteína ${mealLog.total_protein_g}g · ` +
        `Carbos ${mealLog.total_carbs_g}g · ` +
        `Gordura ${mealLog.total_fat_g}g.`,
    };
  },
});

// ──────────────────────────────────────────────────────────────────────────────
// Workflow
// ──────────────────────────────────────────────────────────────────────────────

export const logImageMealWorkflow = new Workflow({
  id: "log-image-meal",
  description:
    "Analyzes a food image with DETIC and immediately logs the detected foods as a meal. " +
    "Step 1 detects foods and finds catalog matches. Step 2 picks the best match per food and saves the meal log.",
  inputSchema: workflowInputSchema,
  outputSchema: mealLogOutputSchema,
})
  .then(analyzeImageStep)
  .then(logMealStep)
  .commit();
