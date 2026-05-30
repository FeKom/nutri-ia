import { searchFoodCatalogTool } from "./tools/search-food-catalog";
import { calculateNutritionTool } from "./tools/calculate-nutrition";
import { findSimilarFoodsTool } from "./tools/find-similar-foods";
import { recommendationTool } from "./tools/recommendation";
import { logMealTool } from "./tools/log-meal";
import { getDailySummaryTool } from "./tools/get-daily-summary";
import { getWeeklyStatsTool } from "./tools/get-weekly-stats";
import { confirmAndLogImageMealTool } from "./tools/confirm-and-log-image-meal";
import { updateUserProfileTool } from "./tools/update-user-profile";
import { calculateMacrosTool } from "./tools/calculate-macros";
import { addGoalTool } from "./tools/add-goal";
import { addActivityTool } from "./tools/add-activity";
import { logImageMealTool } from "./tools/log-image-meal";
import { weeklyProgressReportTool } from "./tools/weekly-progress-report";

export const NUTRITION_TOOLS = {
  searchFoodCatalogTool,
  calculateNutritionTool,
  findSimilarFoodsTool,
  recommendationTool,
  logMealTool,
  getDailySummaryTool,
  getWeeklyStatsTool,
  confirmAndLogImageMealTool,
  updateUserProfileTool,
  calculateMacrosTool,
  add_goal: addGoalTool,
  add_activity: addActivityTool,
  log_image_meal: logImageMealTool,
  weekly_progress_report: weeklyProgressReportTool,
};
