import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { searchFoodsByEmbedding, type SimilarFoodItem } from '../clients/catalog-client';
import { searchFoodOutputSchema } from '../schemas/output';
import { extractAuthContext } from '../utils/auth-context';
import { logger } from '../../utils/logger';

/**
 * Transforma SimilarFoodItem da API para formato da tool
 * API pode retornar strings (Decimal) — converte para number
 */
const toNum = (v: unknown): number => Number(v) || 0;

const formatFoodItem = (food: SimilarFoodItem) => ({
  id: food.id,
  name: food.name,
  category: food.category ?? 'Sem categoria',
  portion: '100g',
  nutrition: {
    calories: toNum(food.calorie_per_100g),
    protein_g: toNum(food.protein_g_100g),
    carbs_g: toNum(food.carbs_g_100g),
    fat_g: toNum(food.fat_g_100g),
  },
});

/**
 * Tool para buscar alimentos no catálogo nutricional
 * Conecta com a Food Catalog API (FastAPI)
 */
export const searchFoodCatalogTool = createTool({
  id: 'search-food-catalog',
  description:
    'Busca alimentos no catálogo nutricional por nome ou categoria. Retorna informações nutricionais básicas.',
  inputSchema: z.object({
    query: z
      .string()
      .describe('Termo de busca (nome do alimento ou categoria)'),
    limit: z
      .number()
      .optional()
      .default(5)
      .describe('Número máximo de resultados (padrão: 5)'),
  }),
  outputSchema: searchFoodOutputSchema,
  execute: async (inputData, executionContext) => {
    const { query, limit = 5 } = inputData;
    const { authToken } = extractAuthContext(executionContext);

    logger.info(`🔍 [Tool] Buscando alimentos (semântica): "${query}" (limite: ${limit})`);

    try {
      const response = await searchFoodsByEmbedding({ query, limit }, undefined, authToken);

      const foods = response.similar_foods.map(formatFoodItem);

      logger.info(`✅ [Tool] Encontrados ${foods.length} alimentos`);

      return {
        success: true,
        foods,
        count: foods.length,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Erro desconhecido';

      logger.error(`❌ [Tool] Erro na busca: ${errorMessage}`);

      return {
        success: false,
        foods: [],
        count: 0,
        error: `Não foi possível buscar alimentos: ${errorMessage}`,
      };
    }
  },
});
