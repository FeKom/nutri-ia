import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { s as searchFoodsByEmbedding, h as findSimilarFoods } from '../catalog-client.mjs';
import { f as findSimilarOutputSchema } from '../output.mjs';
import { e as extractAuthContext, l as logger } from '../logger.mjs';
import '@mastra/core/request-context';
import 'node:async_hooks';
import 'pino';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const toNum = (v) => Number(v) || 0;
const formatSimilarFood = (food) => ({
  id: food.id,
  name: food.name,
  category: food.category ?? "Sem categoria",
  nutrition: {
    calories: toNum(food.calorie_per_100g),
    protein_g: toNum(food.protein_g_100g),
    carbs_g: toNum(food.carbs_g_100g),
    fat_g: toNum(food.fat_g_100g),
    fiber_g: toNum(food.fiber_g_100g)
  },
  similarity_score: food.similarity_score,
  similarity_percent: Math.round(food.similarity_score * 100)
});
const findSimilarFoodsTool = createTool({
  id: "find-similar-foods",
  description: "Encontra alimentos com perfil nutricional similar a um alimento de refer\xEAncia. \xDAtil para sugerir substitui\xE7\xF5es em dietas, encontrar alternativas mais saud\xE1veis, ou descobrir op\xE7\xF5es com macronutrientes equivalentes.",
  inputSchema: z.object({
    foodId: z.string().describe('Nome do alimento ou UUID. Exemplos: "hummus", "frango grelhado", "3f8a...uuid"'),
    limit: z.number().optional().default(5).describe("N\xFAmero m\xE1ximo de alimentos similares (padr\xE3o: 5)"),
    sameCategory: z.boolean().optional().default(false).describe("Se true, retorna apenas alimentos da mesma categoria"),
    tolerance: z.number().optional().default(0.3).describe("Toler\xE2ncia de diferen\xE7a nutricional (0.3 = 30% de diferen\xE7a permitida)")
  }),
  outputSchema: findSimilarOutputSchema,
  execute: async (inputData, executionContext) => {
    const { foodId, limit = 5, sameCategory = false, tolerance = 0.3 } = inputData;
    const { authToken } = extractAuthContext(executionContext);
    logger.info(`\u{1F504} [Tool] Buscando alimentos similares a: "${foodId}"`);
    try {
      let resolvedFoodId = foodId;
      if (!UUID_REGEX.test(foodId)) {
        logger.info(`\u{1F50D} [Tool] "${foodId}" n\xE3o \xE9 UUID, buscando por sem\xE2ntica...`);
        const searchResult = await searchFoodsByEmbedding({ query: foodId, limit: 1 }, void 0, authToken);
        if (!searchResult.similar_foods || searchResult.similar_foods.length === 0) {
          return {
            success: false,
            referenceFood: {
              id: foodId,
              name: foodId,
              category: "Desconhecido",
              nutrition: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
            },
            similarFoods: [],
            count: 0,
            error: `Alimento "${foodId}" n\xE3o encontrado no cat\xE1logo.`
          };
        }
        resolvedFoodId = searchResult.similar_foods[0].id;
        logger.info(`\u2705 [Tool] Resolvido "${foodId}" \u2192 ${searchResult.similar_foods[0].name} (${resolvedFoodId})`);
      }
      const response = await findSimilarFoods({
        food_id: resolvedFoodId,
        limit,
        same_category: sameCategory,
        tolerance
      }, void 0, authToken);
      const referenceFood = {
        id: response.reference_food.id,
        name: response.reference_food.name,
        category: response.reference_food.category ?? "Sem categoria",
        nutrition: {
          calories: toNum(response.reference_food.calorie_per_100g),
          protein_g: toNum(response.reference_food.protein_g_100g),
          carbs_g: toNum(response.reference_food.carbs_g_100g),
          fat_g: toNum(response.reference_food.fat_g_100g)
        }
      };
      const similarFoods = response.similar_foods.map(formatSimilarFood);
      logger.info(`\u2705 [Tool] Encontrados ${similarFoods.length} alimentos similares`);
      return {
        success: true,
        referenceFood,
        similarFoods,
        count: similarFoods.length
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      logger.error(`\u274C [Tool] Erro na busca de similares: ${errorMessage}`);
      return {
        success: false,
        referenceFood: {
          id: foodId,
          name: "Desconhecido",
          category: "Desconhecido",
          nutrition: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
        },
        similarFoods: [],
        count: 0,
        error: `N\xE3o foi poss\xEDvel buscar alimentos similares: ${errorMessage}`
      };
    }
  }
});

export { findSimilarFoodsTool };
