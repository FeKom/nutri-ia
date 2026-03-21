import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { c as calculateNutrition } from '../catalog-client.mjs';
import { c as calculateNutritionOutputSchema } from '../output.mjs';
import { e as extractAuthContext, l as logger } from '../logger.mjs';
import '@mastra/core/request-context';
import 'node:async_hooks';
import 'pino';

const formatNutritionDetail = (detail) => ({
  foodId: detail.food_id,
  foodName: detail.food_name,
  quantity_g: detail.quantity_g,
  calories: detail.calories,
  protein_g: detail.protein_g,
  carbs_g: detail.carbs_g,
  fat_g: detail.fat_g
});
const calculateNutritionTool = createTool({
  id: "calculate-nutrition",
  description: "Utilize essa tool exclusivamente para calculo de alimentosN\xE3o utilize essa tool para calculo nutricional de macros do usu\xE1rio, ao inves disso, utilize a tool calculate-macrosCalcula valores nutricionais totais para uma lista de alimentos com quantidades espec\xEDficas",
  inputSchema: z.object({
    foods: z.array(
      z.object({
        foodId: z.string().describe("ID do alimento no cat\xE1logo"),
        quantity_g: z.number().describe("Quantidade em gramas")
      })
    ).describe("Lista de alimentos com quantidades")
  }),
  outputSchema: calculateNutritionOutputSchema,
  execute: async (inputData, executionContext) => {
    const { foods } = inputData;
    const { authToken } = extractAuthContext(executionContext);
    logger.info(`\u{1F9EE} [Tool] Calculando nutri\xE7\xE3o para ${foods.length} alimentos`);
    try {
      const apiRequest = foods.map((f) => ({
        food_id: f.foodId,
        quantity: f.quantity_g
      }));
      const response = await calculateNutrition(apiRequest, void 0, authToken);
      const details = response.details.map(formatNutritionDetail);
      logger.info(`\u2705 [Tool] Total calculado: ${response.total.calories} kcal`);
      return {
        success: true,
        total: {
          calories: response.total.calories,
          protein_g: response.total.protein_g,
          carbs_g: response.total.carbs_g,
          fat_g: response.total.fat_g
        },
        details
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      logger.error(`\u274C [Tool] Erro no c\xE1lculo: ${errorMessage}`);
      return {
        success: false,
        total: {
          calories: 0,
          protein_g: 0,
          carbs_g: 0,
          fat_g: 0
        },
        details: [],
        error: `N\xE3o foi poss\xEDvel calcular nutri\xE7\xE3o: ${errorMessage}`
      };
    }
  }
});

export { calculateNutritionTool };
