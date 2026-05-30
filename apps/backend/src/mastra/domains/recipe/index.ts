import { searchRecipesTool } from "./tools/search-recipes";
import { getRecipeTool } from "./tools/get-recipe";
import { suggestRecipeTool } from "./tools/suggest-recipe";
import { createMealPlanTool } from "./tools/create-meal-plan";
import { listMealPlansTool } from "./tools/list-meal-plans";
import { getMealPlanTool } from "./tools/get-meal-plan";
import { updateMealPlanTool } from "./tools/update-meal-plan";
import { deleteMealPlanTool } from "./tools/delete-meal-plan";
import { exportMealPlanPdfTool } from "./tools/export-meal-plan-pdf";

export const RECIPE_TOOLS = {
  searchRecipesTool,
  getRecipeTool,
  save_recipe: suggestRecipeTool,
  createMealPlanTool,
  listMealPlansTool,
  getMealPlanTool,
  updateMealPlanTool,
  deleteMealPlanTool,
  exportMealPlanPdfTool,
};
