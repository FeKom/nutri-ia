/**
 * Create Meal Plan Workflow
 *
 * Deterministic 2-step flow:
 *   1. calculate-macros  — reads user profile, computes daily calorie/macro targets
 *   2. create-plan       — saves the meal plan with the calculated targets
 *
 * Why a workflow instead of an agent?
 * The agent would call calculateMacros → createMealPlan in the right order ~95% of the time.
 * This workflow guarantees it 100% and makes the execution traceable in the Mastra playground.
 */

import { createStep, Workflow } from "@mastra/core/workflows";
import { z } from "zod";
import { calculateMacros } from "../api/nutrition";
import { createMealPlan, unwrap } from "../clients/catalog-client";
import type { MealPlan } from "../schemas/meal_plan";
import { asyncContext } from "../../lib/async-context";
import { extractAuthContext } from "../utils/auth-context";
import { logger } from "../../utils/logger";

// ──────────────────────────────────────────────────────────────────────────────
// Schemas
// ──────────────────────────────────────────────────────────────────────────────

const workflowInputSchema = z.object({
  plan_name: z.string().min(1).max(100).describe("Nome do plano alimentar"),
  description: z.string().max(500).optional().describe("Descrição do plano"),
});

const macrosOutputSchema = z.object({
  plan_name: z.string(),
  description: z.string().optional(),
  daily_calories: z.number(),
  daily_protein_g: z.number(),
  daily_carbs_g: z.number(),
  daily_fat_g: z.number(),
  explanation: z.string(),
});

const planOutputSchema = z.object({
  id: z.string(),
  plan_name: z.string(),
  daily_calories: z.number(),
  explanation: z.string(),
  message: z.string(),
});

// ──────────────────────────────────────────────────────────────────────────────
// Step 1 — Calculate macros from user profile
// ──────────────────────────────────────────────────────────────────────────────

const calculateMacrosStep = createStep({
  id: "calculate-macros",
  description: "Calculates daily macro targets from the user's profile data",
  inputSchema: workflowInputSchema,
  outputSchema: macrosOutputSchema,
  execute: async ({ inputData, requestContext }) => {
    const { authToken } = extractAuthContext({ requestContext });
    const userProfile = asyncContext.getStore()?.userProfile ?? null;

    const weight_kg =
      userProfile?.weight != null ? Number(userProfile.weight) : undefined;
    const height_cm =
      userProfile?.height != null ? Number(userProfile.height) : undefined;
    const age =
      userProfile?.age != null ? Number(userProfile.age) : undefined;
    const gender = userProfile?.gender as
      | "male"
      | "female"
      | "non_binary"
      | undefined;
    const activity_level = userProfile?.activity_level;
    const diet_goal = userProfile?.goal;

    const missing: string[] = [];
    if (!weight_kg) missing.push("peso");
    if (!height_cm) missing.push("altura");
    if (!age) missing.push("idade");
    if (!gender) missing.push("gênero");
    if (!activity_level) missing.push("nível de atividade");
    if (!diet_goal) missing.push("objetivo");

    if (missing.length > 0) {
      throw new Error(
        `Perfil incompleto para calcular macros. Campos faltando: ${missing.join(", ")}. ` +
          `Atualize seu perfil em /onboarding antes de criar um plano.`,
      );
    }

    logger.info(
      `[Workflow:createMealPlan] Step 1 — calculating macros for plan "${inputData.plan_name}"`,
    );

    const macros = unwrap(
      await calculateMacros(
        {
          weight_kg: weight_kg!,
          height_cm: height_cm!,
          age: age!,
          gender: gender!,
          activity_level: activity_level!,
          diet_goal: diet_goal!,
        },
        undefined,
        authToken,
      ),
    );

    logger.info(
      `[Workflow:createMealPlan] Step 1 ✅ — ${macros.daily_calories} kcal/day`,
    );

    return {
      plan_name: inputData.plan_name,
      description: inputData.description,
      daily_calories: macros.daily_calories,
      daily_protein_g: macros.daily_protein_g,
      daily_carbs_g: macros.daily_carbs_g,
      daily_fat_g: macros.daily_fat_g,
      explanation: macros.explanation,
    };
  },
});

// ──────────────────────────────────────────────────────────────────────────────
// Step 2 — Create the meal plan in the catalog
// ──────────────────────────────────────────────────────────────────────────────

const createPlanStep = createStep({
  id: "create-plan",
  description:
    "Saves the meal plan with calculated macro targets to the catalog",
  inputSchema: macrosOutputSchema,
  outputSchema: planOutputSchema,
  execute: async ({ inputData, requestContext }) => {
    const { userId, authToken } = extractAuthContext({ requestContext });

    if (!userId) {
      throw new Error(
        "Usuário não autenticado. Faça login para criar planos alimentares.",
      );
    }

    logger.info(
      `[Workflow:createMealPlan] Step 2 — creating plan "${inputData.plan_name}" for user ${userId}`,
    );

    const result: MealPlan = await createMealPlan(
      {
        user_id: userId,
        plan_name: inputData.plan_name,
        description: inputData.description,
        daily_calories: inputData.daily_calories,
        daily_protein_g: inputData.daily_protein_g,
        daily_fat_g: inputData.daily_fat_g,
        daily_carbs_g: inputData.daily_carbs_g,
        created_by: "ai",
        meals: [],
      },
      undefined,
      authToken,
    );

    logger.info(
      `[Workflow:createMealPlan] Step 2 ✅ — plan created: ${result.id}`,
    );

    return {
      id: result.id,
      plan_name: result.plan_name,
      daily_calories: result.daily_calories,
      explanation: inputData.explanation,
      message:
        `Plano "${inputData.plan_name}" criado com sucesso! ` +
        inputData.explanation,
    };
  },
});

// ──────────────────────────────────────────────────────────────────────────────
// Workflow
// ──────────────────────────────────────────────────────────────────────────────

export const createMealPlanWorkflow = new Workflow({
  id: "create-meal-plan",
  description:
    "Creates a personalised meal plan. Automatically calculates daily calorie and macro targets from the user's profile, then saves the plan.",
  inputSchema: workflowInputSchema,
  outputSchema: planOutputSchema,
})
  .then(calculateMacrosStep)
  .then(createPlanStep)
  .commit();
