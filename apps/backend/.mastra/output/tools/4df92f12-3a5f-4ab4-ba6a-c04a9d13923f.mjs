import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { b as createMealPlan } from '../catalog-client.mjs';
import { e as extractAuthContext, l as logger } from '../logger.mjs';
import '@mastra/core/request-context';
import 'node:async_hooks';
import 'pino';

const createMealPlanToolInput = z.object({
  plan_name: z.string().min(1).max(100).describe("Nome do plano alimentar"),
  description: z.string().max(500).optional().describe("Descri\xE7\xE3o do plano alimentar"),
  daily_calories: z.number().positive().describe("Meta di\xE1ria de calorias"),
  daily_protein_g: z.number().positive().describe("Meta di\xE1ria de prote\xEDna em gramas"),
  daily_fat_g: z.number().positive().describe("Meta di\xE1ria de gordura em gramas"),
  daily_carbs_g: z.number().positive().describe("Meta di\xE1ria de carboidratos em gramas"),
  meals: z.array(z.record(z.unknown())).optional().describe("Lista de refei\xE7\xF5es do plano (opcional)")
});
const createMealPlanToolOutput = z.object({
  id: z.string().describe("ID do plano criado"),
  plan_name: z.string().describe("Nome do plano"),
  daily_calories: z.number().describe("Calorias di\xE1rias"),
  created_by: z.string().describe("Criado por (user ou ai)"),
  message: z.string().describe("Mensagem de sucesso")
});
const createMealPlanTool = createTool({
  id: "create_meal_plan",
  description: "Cria um novo plano alimentar (dieta) personalizado para o usu\xE1rio. Use quando o usu\xE1rio pedir para criar uma dieta, plano alimentar, ou definir metas nutricionais. Exemplos: 'Crie uma dieta para perder peso', 'Monta um plano de 2000 calorias', 'Quero um plano low carb'",
  inputSchema: createMealPlanToolInput,
  outputSchema: createMealPlanToolOutput,
  execute: async (inputData, executionContext) => {
    const {
      plan_name,
      description,
      daily_calories,
      daily_protein_g,
      daily_fat_g,
      daily_carbs_g,
      meals = []
    } = inputData;
    const { userId, authToken } = extractAuthContext(executionContext);
    if (!userId) {
      throw new Error(
        "Usu\xE1rio n\xE3o autenticado. Por favor, fa\xE7a login para criar planos alimentares."
      );
    }
    logger.info(
      `\u{1F4CB} [Tool:createMealPlan] Criando plano para usu\xE1rio: ${userId}`
    );
    try {
      const result = await createMealPlan(
        {
          user_id: userId,
          plan_name,
          description,
          daily_calories,
          daily_protein_g,
          daily_fat_g,
          daily_carbs_g,
          created_by: "ai",
          meals
        },
        void 0,
        authToken
      );
      logger.info(`\u2705 [Tool:createMealPlan] Plano criado: ${result.id}`);
      return {
        id: result.id,
        plan_name: result.plan_name,
        daily_calories: result.daily_calories,
        created_by: result.created_by,
        message: `Plano alimentar "${plan_name}" criado com sucesso! Meta di\xE1ria: ${daily_calories} kcal, ${daily_protein_g}g de prote\xEDna, ${daily_carbs_g}g de carboidratos e ${daily_fat_g}g de gordura.`
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      logger.error(`\u274C [Tool:createMealPlan] Erro: ${errorMessage}`);
      throw new Error(`Erro ao criar plano alimentar: ${errorMessage}`);
    }
  }
});

export { createMealPlanTool };
