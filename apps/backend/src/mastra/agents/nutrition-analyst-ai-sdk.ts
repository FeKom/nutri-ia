/**
 * Nutrition Analyst Agent - AI SDK Version
 *
 * Versão migrada usando ToolLoopAgent do Vercel AI SDK
 * para compatibilidade com createAgentUIStreamResponse e useChat no frontend.
 *
 * Usa AsyncLocalStorage para context thread-safe (não mais global mutável).
 */

import { ToolLoopAgent, tool, InferAgentUIMessage } from "ai";
import { z } from "zod";
import { loadNutritionAnalystInstructions } from "../utils/context-loader";
import { getCurrentUserId } from "../../lib/async-context";

// Importar todas as tools do Mastra
import { searchFoodCatalogTool } from "../tools/search-food-catalog";
import { calculateNutritionTool } from "../tools/calculate-nutrition";
import { findSimilarFoodsTool } from "../tools/find-similar-foods";
import { recommendationTool } from "../tools/recommendation";
import { logMealTool } from "../tools/log-meal";
import { getDailySummaryTool } from "../tools/get-daily-summary";
import { getWeeklyStatsTool } from "../tools/get-weekly-stats";
import { createUserProfileTool } from "../tools/create-user-profile";
import { createMealPlanTool } from "../tools/create-meal-plan";
import { listMealPlansTool } from "../tools/list-meal-plans";
import { getMealPlanTool } from "../tools/get-meal-plan";
import { updateMealPlanTool } from "../tools/update-meal-plan";
import { deleteMealPlanTool } from "../tools/delete-meal-plan";
import { analyzeFoodImageTool } from "../tools/analyze-food-image";
import { analyzeFoodImageDeticTool } from "../tools/analyze-food-image-detic";
import { confirmAndLogImageMealTool } from "../tools/confirm-and-log-image-meal";
import { calculateMacrosTool } from "../tools/calculate-macros";

/**
 * Helper para converter ferramentas do Mastra para o formato AI SDK.
 * Usa AsyncLocalStorage para obter userId de forma thread-safe.
 */
function convertMastraToolToAISDK<TInput extends z.ZodTypeAny>(
  mastraTool: any,
) {
  return tool({
    description: mastraTool.description,
    inputSchema: mastraTool.inputSchema as TInput,
    execute: async (input: z.infer<TInput>, options?: any) => {
      try {
        const result = await mastraTool.execute({
          context: input,
          resourceId: getCurrentUserId(),
          runId: `run-${Date.now()}`,
          threadId: `thread-${getCurrentUserId()}`,
        });
        return result;
      } catch (error) {
        console.error(`❌ Error executing tool ${mastraTool.id}:`, error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  });
}

/**
 * Cria agente. O userId é obtido via AsyncLocalStorage no momento
 * da execução das tools, não no momento da criação do agente.
 */
export function createNutritionAnalystAgent() {
  return new ToolLoopAgent({
    model: "github-models/openai/gpt-4o-mini",
    instructions: loadNutritionAnalystInstructions(),

    tools: {
      searchFoodCatalog: convertMastraToolToAISDK(searchFoodCatalogTool),
      calculateNutrition: convertMastraToolToAISDK(calculateNutritionTool),
      calculateMacros: convertMastraToolToAISDK(calculateMacrosTool),
      findSimilarFoods: convertMastraToolToAISDK(findSimilarFoodsTool),
      recommendation: convertMastraToolToAISDK(recommendationTool),
      logMeal: convertMastraToolToAISDK(logMealTool),
      getDailySummary: convertMastraToolToAISDK(getDailySummaryTool),
      getWeeklyStats: convertMastraToolToAISDK(getWeeklyStatsTool),
      createUserProfile: convertMastraToolToAISDK(createUserProfileTool),
      createMealPlan: convertMastraToolToAISDK(createMealPlanTool),
      listMealPlans: convertMastraToolToAISDK(listMealPlansTool),
      getMealPlan: convertMastraToolToAISDK(getMealPlanTool),
      updateMealPlan: convertMastraToolToAISDK(updateMealPlanTool),
      deleteMealPlan: convertMastraToolToAISDK(deleteMealPlanTool),
      analyzeFoodImage: convertMastraToolToAISDK(analyzeFoodImageTool),
      analyzeFoodImageDetic: convertMastraToolToAISDK(analyzeFoodImageDeticTool),
      confirmAndLogImageMeal: convertMastraToolToAISDK(
        confirmAndLogImageMealTool,
      ),
    },
  });
}

/**
 * Agente singleton — thread-safe pois userId vem do AsyncLocalStorage.
 */
export const nutritionAnalystAgentAISDK = createNutritionAnalystAgent();

/**
 * Tipo inferido do agente para usar no frontend com useChat
 */
export type NutritionAnalystUIMessage = InferAgentUIMessage<
  ReturnType<typeof createNutritionAnalystAgent>
>;
