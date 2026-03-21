import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { g as getMealPlan } from '../catalog-client.mjs';
import { e as extractAuthContext, l as logger } from '../logger.mjs';
import '@mastra/core/request-context';
import 'node:async_hooks';
import 'pino';

const getMealPlanToolInput = z.object({
  plan_id: z.string().describe("ID do plano alimentar")
});
const getMealPlanToolOutput = z.object({
  id: z.string(),
  plan_name: z.string(),
  description: z.string().optional(),
  daily_calories: z.number(),
  daily_protein_g: z.number(),
  daily_fat_g: z.number(),
  daily_carbs_g: z.number(),
  created_by: z.string(),
  meals: z.array(z.record(z.unknown())),
  created_at: z.string()
});
const getMealPlanTool = createTool({
  id: "get_meal_plan",
  description: "Busca detalhes de um plano alimentar espec\xEDfico. Use quando o usu\xE1rio pedir detalhes, informa\xE7\xF5es completas, ou quiser ver um plano espec\xEDfico. Exemplos: 'Me mostre detalhes da dieta X', 'Qual \xE9 o plano de 2000 calorias?', 'Informa\xE7\xF5es do meu plano'",
  inputSchema: getMealPlanToolInput,
  outputSchema: getMealPlanToolOutput,
  execute: async (inputData, executionContext) => {
    const { plan_id } = inputData;
    const { userId, authToken } = extractAuthContext(executionContext);
    if (userId === "anonymous") {
      throw new Error(
        "Usu\xE1rio n\xE3o autenticado. Por favor, fa\xE7a login para ver planos."
      );
    }
    logger.info(
      `\u{1F4CB} [Tool:getMealPlan] Buscando plano ${plan_id} para usu\xE1rio: ${userId}`
    );
    try {
      const plan = await getMealPlan(plan_id, userId, void 0, authToken);
      logger.info(
        `\u2705 [Tool:getMealPlan] Plano encontrado: "${plan.plan_name}"`
      );
      return {
        id: plan.id,
        plan_name: plan.plan_name,
        description: plan.description,
        daily_calories: plan.daily_calories,
        daily_protein_g: plan.daily_protein_g,
        daily_fat_g: plan.daily_fat_g,
        daily_carbs_g: plan.daily_carbs_g,
        created_by: plan.created_by,
        meals: plan.meals,
        created_at: plan.created_at
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      logger.error(`\u274C [Tool:getMealPlan] Erro: ${errorMessage}`);
      throw new Error(
        `Erro ao buscar plano: ${errorMessage}. Verifique se o ID est\xE1 correto e se voc\xEA tem permiss\xE3o para acessar este plano.`
      );
    }
  }
});

export { getMealPlanTool };
