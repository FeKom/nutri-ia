/**
 * Weekly Progress Report Workflow
 *
 * Deterministic 2-step flow:
 *   1. fetch-stats-and-summary  — fetches weekly stats + today's daily summary in parallel,
 *                                 then computes which macro had the lowest adherence
 *   2. fetch-recommendations    — fetches personalized food recommendations targeting the weakest nutrient
 *
 * Auth note: userId and authToken are passed explicitly in the input schema.
 * Do NOT rely on asyncContext inside workflow steps.
 */

import { createStep, Workflow } from "@mastra/core/workflows";
import { z } from "zod";
import { getWeeklyStats, getDailySummary, getRecommendations } from "../clients/catalog-client";
import { logger } from "../../utils/logger";

// ──────────────────────────────────────────────────────────────────────────────
// Schemas
// ──────────────────────────────────────────────────────────────────────────────

const workflowInputSchema = z.object({
  days: z.number().int().min(1).max(30).default(7).describe("Número de dias do período (1-30)"),
  userId: z.string().describe("ID do usuário autenticado"),
  authToken: z.string().describe("JWT Bearer token"),
});

const todaySchema = z.object({
  date: z.string(),
  totals: z.object({
    calories: z.number(),
    protein_g: z.number(),
    carbs_g: z.number(),
    fat_g: z.number(),
  }),
  targets: z.object({
    calories: z.number(),
    protein_g: z.number(),
    carbs_g: z.number(),
    fat_g: z.number(),
  }),
  progress: z.object({
    calories_pct: z.number(),
    protein_pct: z.number(),
    carbs_pct: z.number(),
    fat_pct: z.number(),
  }),
  num_meals: z.number(),
}).nullable();

const dayStatsSchema = z.object({
  date: z.string(),
  total_calories: z.number(),
  total_protein_g: z.number(),
  total_carbs_g: z.number(),
  total_fat_g: z.number(),
  num_meals: z.number(),
});

const statsAndSummarySchema = z.object({
  userId: z.string(),
  authToken: z.string(),
  num_days: z.number(),
  averages: z.object({
    calories: z.number(),
    protein_g: z.number(),
    carbs_g: z.number(),
    fat_g: z.number(),
  }),
  adherence_rate: z.number(),
  stats: z.array(dayStatsSchema),
  today: todaySchema,
  weakest_nutrient: z.string(),
});

const recommendationSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  nutrition: z.object({
    calories_per_100g: z.number(),
    protein_g: z.number(),
    carbs_g: z.number(),
    fat_g: z.number(),
  }),
});

const reportOutputSchema = z.object({
  period_days: z.number(),
  adherence_rate: z.number(),
  averages: z.object({
    calories: z.number(),
    protein_g: z.number(),
    carbs_g: z.number(),
    fat_g: z.number(),
  }),
  stats: z.array(dayStatsSchema),
  today: todaySchema,
  weakest_nutrient: z.string(),
  recommendations: z.array(recommendationSchema),
  message: z.string(),
});

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

type ProgressData = {
  calories_pct: number;
  protein_pct: number;
  carbs_pct: number;
  fat_pct: number;
};

function getWeakestNutrient(progress: ProgressData): string {
  const nutrients = [
    { name: "protein", pct: progress.protein_pct },
    { name: "carbs", pct: progress.carbs_pct },
    { name: "fat", pct: progress.fat_pct },
  ];
  return nutrients.reduce((min, n) => (n.pct < min.pct ? n : min)).name;
}

// Maps macro name to a catalog food category for recommendations
const NUTRIENT_TO_CATEGORY: Record<string, string | undefined> = {
  protein: "protein",
  carbs: undefined,  // catalog doesn't have a "carbs" category — skip filter
  fat: undefined,
};

// ──────────────────────────────────────────────────────────────────────────────
// Step 1 — Fetch weekly stats + daily summary in parallel
// ──────────────────────────────────────────────────────────────────────────────

const fetchStatsAndSummaryStep = createStep({
  id: "fetch-stats-and-summary",
  description:
    "Fetches weekly nutrition stats and today's daily summary in parallel, then computes which macro had the lowest adherence",
  inputSchema: workflowInputSchema,
  outputSchema: statsAndSummarySchema,
  execute: async ({ inputData }) => {
    const { days, userId, authToken } = inputData;
    const today = new Date().toISOString().split("T")[0];

    logger.info(
      `[Workflow:weeklyProgressReport] Step 1 — fetching ${days}-day stats + daily summary for user ${userId}`,
    );

    const [weeklyStats, dailySummary] = await Promise.all([
      getWeeklyStats(userId, days, undefined, authToken),
      getDailySummary(userId, today, undefined, authToken).catch((err) => {
        logger.warn(`[Workflow:weeklyProgressReport] Daily summary unavailable: ${err?.message}`);
        return null;
      }),
    ]);

    const weakest_nutrient = dailySummary
      ? getWeakestNutrient(dailySummary.progress)
      : "protein";

    logger.info(
      `[Workflow:weeklyProgressReport] Step 1 ✅ — ${weeklyStats.stats.length} day(s), adherence ${Math.round(weeklyStats.adherence_rate * 100)}%, weakest: ${weakest_nutrient}`,
    );

    return {
      userId,
      authToken,
      num_days: weeklyStats.stats.length,
      averages: weeklyStats.averages,
      adherence_rate: weeklyStats.adherence_rate,
      stats: weeklyStats.stats.map((s) => ({
        date: s.date,
        total_calories: s.total_calories,
        total_protein_g: s.total_protein_g,
        total_carbs_g: s.total_carbs_g,
        total_fat_g: s.total_fat_g,
        num_meals: s.num_meals,
      })),
      today: dailySummary
        ? {
            date: dailySummary.date,
            totals: {
              calories: dailySummary.totals.calories,
              protein_g: dailySummary.totals.protein_g,
              carbs_g: dailySummary.totals.carbs_g,
              fat_g: dailySummary.totals.fat_g,
            },
            targets: dailySummary.targets,
            progress: dailySummary.progress,
            num_meals: dailySummary.num_meals,
          }
        : null,
      weakest_nutrient,
    };
  },
});

// ──────────────────────────────────────────────────────────────────────────────
// Step 2 — Fetch personalized recommendations
// ──────────────────────────────────────────────────────────────────────────────

const fetchRecommendationsStep = createStep({
  id: "fetch-recommendations",
  description: "Fetches personalized food recommendations targeting the nutrient with lowest adherence",
  inputSchema: statsAndSummarySchema,
  outputSchema: reportOutputSchema,
  execute: async ({ inputData }) => {
    const {
      userId,
      authToken,
      weakest_nutrient,
      num_days,
      adherence_rate,
      averages,
      stats,
      today,
    } = inputData;

    logger.info(
      `[Workflow:weeklyProgressReport] Step 2 — fetching recommendations (targeting: ${weakest_nutrient})`,
    );

    const category = NUTRIENT_TO_CATEGORY[weakest_nutrient];

    const recommendations = await getRecommendations(
      { user_id: userId, limit: 10, ...(category ? { category } : {}) },
      undefined,
      authToken,
    ).catch((err) => {
      logger.warn(`[Workflow:weeklyProgressReport] Recommendations unavailable: ${err?.message}`);
      return { foods: [], count: 0, filters_applied: { dietary_restrictions: [], allergies: [], disliked_foods: [] } };
    });

    logger.info(
      `[Workflow:weeklyProgressReport] Step 2 ✅ — ${recommendations.count} recommendation(s)`,
    );

    const adherencePct = Math.round(adherence_rate * 100);

    return {
      period_days: num_days,
      adherence_rate,
      averages,
      stats,
      today,
      weakest_nutrient,
      recommendations: recommendations.foods.slice(0, 10).map((f) => ({
        id: f.id,
        name: f.name,
        category: f.category ?? "Sem categoria",
        nutrition: {
          calories_per_100g: f.calorie_per_100g ?? 0,
          protein_g: f.protein_g_100g ?? 0,
          carbs_g: f.carbs_g_100g ?? 0,
          fat_g: f.fat_g_100g ?? 0,
        },
      })),
      message:
        `Relatório dos últimos ${num_days} dia(s): ` +
        `aderência ${adherencePct}%. ` +
        `Média de ${Math.round(averages.calories)} kcal/dia. ` +
        `Nutriente com menor aderência: ${weakest_nutrient}. ` +
        `${recommendations.count} alimento(s) recomendado(s).`,
    };
  },
});

// ──────────────────────────────────────────────────────────────────────────────
// Workflow
// ──────────────────────────────────────────────────────────────────────────────

export const weeklyProgressReportWorkflow = new Workflow({
  id: "weekly-progress-report",
  description:
    "Generates a comprehensive weekly progress report. " +
    "Step 1 fetches weekly stats and today's summary in parallel, computing the weakest macro. " +
    "Step 2 fetches personalized food recommendations targeting that macro.",
  inputSchema: workflowInputSchema,
  outputSchema: reportOutputSchema,
})
  .then(fetchStatsAndSummaryStep)
  .then(fetchRecommendationsStep)
  .commit();
