/**
 * Create Meal Plan Workflow
 *
 * Deterministic 2-step flow:
 *   1. calculate-macros  — computes daily calorie/macro targets from profile data
 *   2. create-plan       — saves the meal plan with the calculated targets
 *
 * Auth note: userId and authToken are passed explicitly in the input schema.
 * Do NOT rely on asyncContext or requestContext inside workflow steps — Mastra
 * executes steps in a separate async context where those stores are not propagated.
 */

import { createStep, Workflow } from "@mastra/core/workflows";
import { z } from "zod";
import { calculateMacros } from "../api/nutrition";
import { createMealPlan, unwrap } from "../clients/catalog-client";
import type { MealPlan } from "../schemas/meal_plan";
import { logger } from "../../utils/logger";

// ──────────────────────────────────────────────────────────────────────────────
// Schemas
// ──────────────────────────────────────────────────────────────────────────────

const workflowInputSchema = z.object({
  plan_name: z.string().min(1).max(100).describe("Nome do plano alimentar"),
  description: z.string().max(500).optional().describe("Descrição do plano"),
  // Auth — passed explicitly so steps don't need asyncContext/requestContext
  userId: z.string().describe("ID do usuário autenticado"),
  authToken: z.string().describe("JWT Bearer token"),
  // Profile fields — passed from the caller so step 1 doesn't need a DB fetch
  weight_kg: z.number().positive().describe("Peso em kg"),
  height_cm: z.number().positive().describe("Altura em cm"),
  age: z.number().int().positive().describe("Idade"),
  gender: z.enum(["male", "female", "non_binary"]).describe("Gênero"),
  activity_level: z
    .enum(["sedentary", "light", "moderate", "active", "very_active"])
    .describe("Nível de atividade física"),
  diet_goal: z
    .enum(["weight_loss", "weight_gain", "maintain"])
    .describe("Objetivo"),
});

const macrosOutputSchema = z.object({
  plan_name: z.string(),
  description: z.string().optional(),
  userId: z.string(),
  authToken: z.string(),
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
// Step 1 — Calculate macros
// ──────────────────────────────────────────────────────────────────────────────

const calculateMacrosStep = createStep({
  id: "calculate-macros",
  description: "Calculates daily macro targets from the user's profile data",
  inputSchema: workflowInputSchema,
  outputSchema: macrosOutputSchema,
  execute: async ({ inputData }) => {
    const {
      plan_name,
      description,
      userId,
      authToken,
      weight_kg,
      height_cm,
      age,
      gender,
      activity_level,
      diet_goal,
    } = inputData;

    logger.info(
      `[Workflow:createMealPlan] Step 1 — calculating macros for plan "${plan_name}" (user ${userId})`,
    );

    const macros = unwrap(
      await calculateMacros(
        { weight_kg, height_cm, age, gender, activity_level, diet_goal },
        undefined,
        authToken,
      ),
    );

    logger.info(
      `[Workflow:createMealPlan] Step 1 ✅ — ${macros.daily_calories} kcal/day`,
    );

    return {
      plan_name,
      description,
      userId,
      authToken,
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
  execute: async ({ inputData }) => {
    const {
      userId,
      authToken,
      plan_name,
      description,
      daily_calories,
      daily_protein_g,
      daily_carbs_g,
      daily_fat_g,
      explanation,
    } = inputData;

    logger.info(
      `[Workflow:createMealPlan] Step 2 — creating plan "${plan_name}" for user ${userId}`,
    );

    const result: MealPlan = await createMealPlan(
      {
        user_id: userId,
        plan_name,
        description,
        daily_calories,
        daily_protein_g,
        daily_fat_g,
        daily_carbs_g,
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
      explanation,
      message:
        `Plano "${plan_name}" criado com sucesso! ` + explanation,
    };
  },
});

// ──────────────────────────────────────────────────────────────────────────────
// Workflow
// ──────────────────────────────────────────────────────────────────────────────

export const createMealPlanWorkflow = new Workflow({
  id: "create-meal-plan",
  description:
    "Creates a personalised meal plan. Calculates daily calorie and macro targets from the user's profile, then saves the plan.",
  inputSchema: workflowInputSchema,
  outputSchema: planOutputSchema,
})
  .then(calculateMacrosStep)
  .then(createPlanStep)
  .commit();
