import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { findSimilarFoods, searchFoodsByEmbedding, type SimilarFoodItem } from '../clients/catalog-client';
import { findSimilarOutputSchema } from '../schemas/output';
import { extractAuthContext } from '../utils/auth-context';
import { logger } from '../../utils/logger';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Transforma SimilarFoodItem da API para formato da tool
 * API pode retornar strings (Decimal) — converte para number
 */
const toNum = (v: unknown): number => Number(v) || 0;

const formatSimilarFood = (food: SimilarFoodItem) => ({
  id: food.id,
  name: food.name,
  category: food.category ?? 'Sem categoria',
  nutrition: {
    calories: toNum(food.calorie_per_100g),
    protein_g: toNum(food.protein_g_100g),
    carbs_g: toNum(food.carbs_g_100g),
    fat_g: toNum(food.fat_g_100g),
    fiber_g: toNum(food.fiber_g_100g),
  },
  similarity_score: food.similarity_score,
  similarity_percent: Math.round(food.similarity_score * 100),
});

/**
 * Tool para encontrar alimentos similares no catálogo nutricional
 * Útil para sugerir substituições em dietas mantendo perfil nutricional
 */
export const findSimilarFoodsTool = createTool({
  id: 'find-similar-foods',
  description:
    'Encontra alimentos com perfil nutricional similar a um alimento de referência. ' +
    'Útil para sugerir substituições em dietas, encontrar alternativas mais saudáveis, ' +
    'ou descobrir opções com macronutrientes equivalentes.',
  inputSchema: z.object({
    foodId: z
      .string()
      .describe('Nome do alimento ou UUID. Exemplos: "hummus", "frango grelhado", "3f8a...uuid"'),
    limit: z
      .number()
      .optional()
      .default(5)
      .describe('Número máximo de alimentos similares (padrão: 5)'),
    sameCategory: z
      .boolean()
      .optional()
      .default(false)
      .describe('Se true, retorna apenas alimentos da mesma categoria'),
    tolerance: z
      .number()
      .optional()
      .default(0.3)
      .describe('Tolerância de diferença nutricional (0.3 = 30% de diferença permitida)'),
  }),
  outputSchema: findSimilarOutputSchema,
  execute: async (inputData, executionContext) => {
    const { foodId, limit = 5, sameCategory = false, tolerance = 0.3 } = inputData;
    const { authToken } = extractAuthContext(executionContext);

    logger.info(`🔄 [Tool] Buscando alimentos similares a: "${foodId}"`);

    try {
      let resolvedFoodId = foodId;

      // If not a UUID, search by name first to resolve
      if (!UUID_REGEX.test(foodId)) {
        logger.info(`🔍 [Tool] "${foodId}" não é UUID, buscando por semântica...`);
        const searchResult = await searchFoodsByEmbedding({ query: foodId, limit: 1 }, undefined, authToken);
        if (!searchResult.similar_foods || searchResult.similar_foods.length === 0) {
          return {
            success: false,
            referenceFood: {
              id: foodId,
              name: foodId,
              category: 'Desconhecido',
              nutrition: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
            },
            similarFoods: [],
            count: 0,
            error: `Alimento "${foodId}" não encontrado no catálogo.`,
          };
        }
        resolvedFoodId = searchResult.similar_foods[0].id;
        logger.info(`✅ [Tool] Resolvido "${foodId}" → ${searchResult.similar_foods[0].name} (${resolvedFoodId})`);
      }

      const response = await findSimilarFoods({
        food_id: resolvedFoodId,
        limit,
        same_category: sameCategory,
        tolerance,
      }, undefined, authToken);

      const referenceFood = {
        id: response.reference_food.id,
        name: response.reference_food.name,
        category: response.reference_food.category ?? 'Sem categoria',
        nutrition: {
          calories: toNum(response.reference_food.calorie_per_100g),
          protein_g: toNum(response.reference_food.protein_g_100g),
          carbs_g: toNum(response.reference_food.carbs_g_100g),
          fat_g: toNum(response.reference_food.fat_g_100g),
        },
      };

      const similarFoods = response.similar_foods.map(formatSimilarFood);

      logger.info(`✅ [Tool] Encontrados ${similarFoods.length} alimentos similares`);

      return {
        success: true,
        referenceFood,
        similarFoods,
        count: similarFoods.length,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Erro desconhecido';

      logger.error(`❌ [Tool] Erro na busca de similares: ${errorMessage}`);

      return {
        success: false,
        referenceFood: {
          id: foodId,
          name: 'Desconhecido',
          category: 'Desconhecido',
          nutrition: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
        },
        similarFoods: [],
        count: 0,
        error: `Não foi possível buscar alimentos similares: ${errorMessage}`,
      };
    }
  },
});
