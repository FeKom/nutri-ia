import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { u as updateMealPlan } from '../catalog-client.mjs';
import { e as extractAuthContext, l as logger } from '../logger.mjs';
import '@mastra/core/request-context';
import 'node:async_hooks';
import 'pino';

const updateMealPlanToolInput = z.object({
  plan_id: z.string().describe("ID do plano a atualizar"),
  plan_name: z.string().min(1).max(100).optional().describe("Novo nome do plano"),
  description: z.string().max(500).optional().describe("Nova descri\xE7\xE3o"),
  daily_calories: z.number().positive().optional().describe("Nova meta de calorias"),
  daily_protein_g: z.number().positive().optional().describe("Nova meta de prote\xEDna"),
  daily_fat_g: z.number().positive().optional().describe("Nova meta de gordura"),
  daily_carbs_g: z.number().positive().optional().describe("Nova meta de carboidratos"),
  meals: z.array(z.record(z.unknown())).optional().describe("Novas refei\xE7\xF5es")
});
const updateMealPlanToolOutput = z.object({
  id: z.string(),
  plan_name: z.string(),
  daily_calories: z.number(),
  message: z.string()
});
const updateMealPlanTool = createTool({
  id: "update_meal_plan",
  description: "Atualiza um plano alimentar existente. Use quando o usu\xE1rio pedir para editar, modificar, ajustar um plano. Exemplos: 'Ajusta a dieta para 1800 calorias', 'Muda o nome do plano', 'Adiciona mais prote\xEDna'",
  inputSchema: updateMealPlanToolInput,
  outputSchema: updateMealPlanToolOutput,
  execute: async (inputData, executionContext) => {
    const { plan_id, ...updates } = inputData;
    const { userId, authToken } = extractAuthContext(executionContext);
    if (userId === "anonymous") {
      throw new Error(
        "Usu\xE1rio n\xE3o autenticado. Por favor, fa\xE7a login para editar planos."
      );
    }
    logger.info(
      `\u{1F4CB} [Tool:updateMealPlan] Atualizando plano ${plan_id} para usu\xE1rio: ${userId}`
    );
    try {
      const result = await updateMealPlan(
        plan_id,
        userId,
        updates,
        void 0,
        authToken
      );
      logger.info(
        `\u2705 [Tool:updateMealPlan] Plano atualizado: "${result.plan_name}"`
      );
      return {
        id: result.id,
        plan_name: result.plan_name,
        daily_calories: result.daily_calories,
        message: `Plano "${result.plan_name}" atualizado com sucesso!`
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      logger.error(`\u274C [Tool:updateMealPlan] Erro: ${errorMessage}`);
      throw new Error(
        `Erro ao atualizar plano: ${errorMessage}. Verifique se o ID est\xE1 correto e se voc\xEA tem permiss\xE3o para editar este plano.`
      );
    }
  }
});

export { updateMealPlanTool };
