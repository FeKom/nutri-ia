import { Agent } from "@mastra/core/agent";
import { env } from "../config/env";
import { loadNutritionAnalystInstructions } from "../utils/context-loader";
import { createNutritionMemory } from "../config/memory";
import { updateUserProfileTool } from "../tools/update-user-profile";
import { calculateMacrosTool } from "../tools/calculate-macros";
import { createMealPlanTool } from "../tools/create-meal-plan";
import { addGoalTool } from "../tools/add-goal";
import { addActivityTool } from "../tools/add-activity";
import { suggestRecipeTool } from "../tools/suggest-recipe";
import { toolSearch } from "../config/toolProcessor";

/**
 * Nutrition Analyst Agent
 * Responsável por análise de alimentos e cálculos nutricionais
 *
 * Tools estáticas: sempre disponíveis (fluxos críticos encadeados)
 * Tools dinâmicas: carregadas via ToolSearchProcessor conforme contexto
 */
export const nutritionAnalystAgent = new Agent({
  id: "nutrition-analyst",
  name: "nutrition-analyst",
  description:
    "Agente especializado em análise nutricional, identificação de alimentos em imagens e busca de alimentos",
  instructions: loadNutritionAnalystInstructions(),
  model: env.MODEL,
  memory: createNutritionMemory(),
  inputProcessors: [toolSearch],
  tools: {
    // Tools estáticas - sempre disponíveis independente do ToolSearchProcessor
    update_user_profile: updateUserProfileTool,
    calculate_macros: calculateMacrosTool,
    create_meal_plan: createMealPlanTool,
    add_goal: addGoalTool,
    add_activity: addActivityTool,
    save_recipe: suggestRecipeTool,
  },
});
