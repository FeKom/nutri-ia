import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { s as searchFoodsByEmbedding } from '../catalog-client.mjs';
import { s as searchFoodOutputSchema } from '../output.mjs';
import { e as extractAuthContext, l as logger } from '../logger.mjs';
import '@mastra/core/request-context';
import 'node:async_hooks';
import 'pino';

const toNum = (v) => Number(v) || 0;
const formatFoodItem = (food) => ({
  id: food.id,
  name: food.name,
  category: food.category ?? "Sem categoria",
  portion: "100g",
  nutrition: {
    calories: toNum(food.calorie_per_100g),
    protein_g: toNum(food.protein_g_100g),
    carbs_g: toNum(food.carbs_g_100g),
    fat_g: toNum(food.fat_g_100g)
  }
});
const searchFoodCatalogTool = createTool({
  id: "search-food-catalog",
  description: "Busca alimentos no cat\xE1logo nutricional por nome ou categoria. Retorna informa\xE7\xF5es nutricionais b\xE1sicas.",
  inputSchema: z.object({
    query: z.string().describe("Termo de busca (nome do alimento ou categoria)"),
    limit: z.number().optional().default(5).describe("N\xFAmero m\xE1ximo de resultados (padr\xE3o: 5)")
  }),
  outputSchema: searchFoodOutputSchema,
  execute: async (inputData, executionContext) => {
    const { query, limit = 5 } = inputData;
    const { authToken } = extractAuthContext(executionContext);
    logger.info(`\u{1F50D} [Tool] Buscando alimentos (sem\xE2ntica): "${query}" (limite: ${limit})`);
    try {
      const response = await searchFoodsByEmbedding({ query, limit }, void 0, authToken);
      const foods = response.similar_foods.map(formatFoodItem);
      logger.info(`\u2705 [Tool] Encontrados ${foods.length} alimentos`);
      return {
        success: true,
        foods,
        count: foods.length
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      logger.error(`\u274C [Tool] Erro na busca: ${errorMessage}`);
      return {
        success: false,
        foods: [],
        count: 0,
        error: `N\xE3o foi poss\xEDvel buscar alimentos: ${errorMessage}`
      };
    }
  }
});

export { searchFoodCatalogTool };
