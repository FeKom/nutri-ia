import { ToolSearchProcessor } from "@mastra/core/processors";
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
// DETIC tool mantida no código mas removida do MVP (requer GPU)
// import { analyzeFoodImageDeticTool } from "../tools/analyze-food-image-detic";
import { confirmAndLogImageMealTool } from "../tools/confirm-and-log-image-meal";
import { createUserProfileTool } from "../tools/create-user-profile";
import { updateUserProfileTool } from "../tools/update-user-profile";
import { calculateMacrosTool } from "../tools/calculate-macros";
import { exportMealPlanPdfTool } from "../tools/export-meal-plan-pdf";
import { searchRecipesTool } from "../tools/search-recipes";
import { getRecipeTool } from "../tools/get-recipe";

export const toolSearch = new ToolSearchProcessor({
  tools: {
    searchFoodCatalogTool,
    calculateNutritionTool,
    findSimilarFoodsTool,
    recommendationTool,
    logMealTool,
    getDailySummaryTool,
    getWeeklyStatsTool,
    listMealPlansTool,
    getMealPlanTool,
    updateMealPlanTool,
    deleteMealPlanTool,
    // analyzeFoodImageDeticTool, // MVP: agente usa visão nativa do LLM
    confirmAndLogImageMealTool,
    createUserProfileTool,
    updateUserProfileTool,
    calculateMacrosTool,
    exportMealPlanPdfTool,
    searchRecipesTool,
    getRecipeTool,
  },
  search: {
    topK: 4,
    minScore: 0.35,
  },
});
