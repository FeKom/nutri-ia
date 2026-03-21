import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { l as logMeal } from '../catalog-client.mjs';
import { e as extractAuthContext, l as logger } from '../logger.mjs';
import '@mastra/core/request-context';
import 'node:async_hooks';
import 'pino';

const logMealToolInput = z.object({
  // user_id é obtido automaticamente do contexto (resourceId)
  meal_type: z.enum(["breakfast", "lunch", "dinner", "snack"]).describe("Tipo de refei\xE7\xE3o (breakfast, lunch, dinner, snack)"),
  foods: z.array(
    z.object({
      food_id: z.string().describe("ID do alimento"),
      quantity_g: z.number().positive().describe("Quantidade em gramas"),
      name: z.string().optional().describe("Nome do alimento (opcional)")
    })
  ).min(1).describe("Lista de alimentos consumidos"),
  notes: z.string().optional().describe("Notas sobre a refei\xE7\xE3o (opcional)")
});
const logMealTool = createTool({
  id: "log_meal",
  description: "Registra uma refei\xE7\xE3o consumida pelo usu\xE1rio com todos os alimentos e quantidades. Calcula automaticamente os totais nutricionais e atualiza as estat\xEDsticas di\xE1rias. Use esta ferramenta quando o usu\xE1rio disser que comeu, consumiu ou registrou uma refei\xE7\xE3o. Exemplos: 'Comi 2 ovos no caf\xE9 da manh\xE3', 'Registrar almo\xE7o com arroz e feij\xE3o'",
  inputSchema: logMealToolInput,
  outputSchema: z.object({
    id: z.string().describe("ID do registro da refei\xE7\xE3o"),
    total_calories: z.number().describe("Total de calorias da refei\xE7\xE3o"),
    total_protein_g: z.number().describe("Total de prote\xEDna em gramas"),
    total_carbs_g: z.number().describe("Total de carboidratos em gramas"),
    total_fat_g: z.number().describe("Total de gordura em gramas"),
    meal_type: z.string().describe("Tipo de refei\xE7\xE3o"),
    num_foods: z.number().describe("N\xFAmero de alimentos na refei\xE7\xE3o")
  }),
  execute: async (inputData, executionContext) => {
    const { meal_type, foods, notes } = inputData;
    const { userId, authToken } = extractAuthContext(executionContext);
    logger.info(`\u{1F37D}\uFE0F [Tool:logMeal] Registrando refei\xE7\xE3o para usu\xE1rio: ${userId}`);
    logger.info(`   Tipo: ${meal_type}, Alimentos: ${foods.length}`);
    try {
      const result = await logMeal(
        {
          user_id: userId,
          meal_type,
          foods,
          notes
        },
        void 0,
        authToken
      );
      return {
        id: result.id,
        total_calories: result.total_calories,
        total_protein_g: result.total_protein_g,
        total_carbs_g: result.total_carbs_g,
        total_fat_g: result.total_fat_g,
        meal_type: result.meal_type,
        num_foods: result.foods.length
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erro desconhecido";
      logger.error(`\u274C [Tool:logMeal] Erro: ${msg}`);
      return {
        id: "",
        total_calories: 0,
        total_protein_g: 0,
        total_carbs_g: 0,
        total_fat_g: 0,
        meal_type,
        num_foods: 0
      };
    }
  }
});

export { logMealTool };
