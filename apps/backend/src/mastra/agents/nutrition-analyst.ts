import { Agent } from "@mastra/core/agent";
import { env } from "../config/env";
import { loadNutritionAnalystInstructions } from "../utils/context-loader";
import { createNutritionMemory } from "../config/memory";
import { NutriaProcessor } from "../processors/NutriaProcessor";
import {
  promptInjectionDetector,
  inputModerationProcessor,
  piiDetector,
  outputModerationProcessor,
  nutritionalOutputGuardrail,
} from "../config/guardrails";
import { searchFoodCatalogTool } from "../tools/search-food-catalog";
import { calculateNutritionTool } from "../tools/calculate-nutrition";
import { findSimilarFoodsTool } from "../tools/find-similar-foods";
import { recommendationTool } from "../tools/recommendation";
import { logMealTool } from "../tools/log-meal";
import { getDailySummaryTool } from "../tools/get-daily-summary";
import { getWeeklyStatsTool } from "../tools/get-weekly-stats";
import { createMealPlanTool } from "../tools/create-meal-plan";
import { listMealPlansTool } from "../tools/list-meal-plans";
import { getMealPlanTool } from "../tools/get-meal-plan";
import { updateMealPlanTool } from "../tools/update-meal-plan";
import { deleteMealPlanTool } from "../tools/delete-meal-plan";
import { confirmAndLogImageMealTool } from "../tools/confirm-and-log-image-meal";
import { updateUserProfileTool } from "../tools/update-user-profile";
import { calculateMacrosTool } from "../tools/calculate-macros";
import { exportMealPlanPdfTool } from "../tools/export-meal-plan-pdf";
import { searchRecipesTool } from "../tools/search-recipes";
import { getRecipeTool } from "../tools/get-recipe";
import { addGoalTool } from "../tools/add-goal";
import { addActivityTool } from "../tools/add-activity";
import { suggestRecipeTool } from "../tools/suggest-recipe";
import { logImageMealTool } from "../tools/log-image-meal";
import { weeklyProgressReportTool } from "../tools/weekly-progress-report";

// All tools registered statically so Mastra Studio can discover them.
// NutriaProcessor narrows the active set per step at runtime based on intent.
const ALL_TOOLS = {
  searchFoodCatalogTool,
  calculateNutritionTool,
  findSimilarFoodsTool,
  recommendationTool,
  logMealTool,
  getDailySummaryTool,
  getWeeklyStatsTool,
  createMealPlanTool,
  listMealPlansTool,
  getMealPlanTool,
  updateMealPlanTool,
  deleteMealPlanTool,
  confirmAndLogImageMealTool,
  updateUserProfileTool,
  calculateMacrosTool,
  exportMealPlanPdfTool,
  searchRecipesTool,
  getRecipeTool,
  add_goal: addGoalTool,
  add_activity: addActivityTool,
  save_recipe: suggestRecipeTool,
  log_image_meal: logImageMealTool,
  weekly_progress_report: weeklyProgressReportTool,
};

export const nutritionAnalystAgent = new Agent({
  id: "nutrition-analyst",
  name: "nutrition-analyst",
  description:
    "Agente especializado em análise nutricional, identificação de alimentos em imagens e busca de alimentos",
  instructions: loadNutritionAnalystInstructions(),
  model: env.MODEL,
  memory: createNutritionMemory(),
  inputProcessors: [
    promptInjectionDetector,
    inputModerationProcessor,
    piiDetector,
    new NutriaProcessor(5),
  ],
  outputProcessors: [outputModerationProcessor, nutritionalOutputGuardrail],
  tools: ALL_TOOLS,
});
