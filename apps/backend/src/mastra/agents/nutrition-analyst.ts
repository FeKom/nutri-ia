import { Agent } from "@mastra/core/agent";
import { env } from "../config/env";
import { loadNutritionAnalystInstructions } from "../utils/context-loader";
import { createNutritionMemory } from "../config/memory";
import { addGoalTool } from "../tools/add-goal";
import { addActivityTool } from "../tools/add-activity";
import { suggestRecipeTool } from "../tools/suggest-recipe";
import { toolInjectorProcessor } from "../config/toolInjectorProcessor";

/**
 * Nutrition Analyst Agent
 *
 * Tools are injected per-step by ToolInjectorProcessor based on user intent:
 *   - Regex fast-path covers ~90% of cases
 *   - Small AI model (Phi-4-mini) classifies ambiguous messages
 *
 * Static tools below are always available regardless of intent.
 */
export const nutritionAnalystAgent = new Agent({
  id: "nutrition-analyst",
  name: "nutrition-analyst",
  description:
    "Agente especializado em análise nutricional, identificação de alimentos em imagens e busca de alimentos",
  instructions: loadNutritionAnalystInstructions(),
  model: env.MODEL,
  memory: createNutritionMemory(),
  inputProcessors: [toolInjectorProcessor],
  tools: {
    add_goal: addGoalTool,
    add_activity: addActivityTool,
    save_recipe: suggestRecipeTool,
  },
});
