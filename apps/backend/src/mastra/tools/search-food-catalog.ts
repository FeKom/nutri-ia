import { withAuth } from '../utils/with-auth';
import { z } from 'zod';
import { searchFoodsByEmbedding, type SimilarFoodsResponse } from '../clients/catalog-client';
import { searchFoodOutputSchema } from '../schemas/output';
import { logger } from '../../utils/logger';
import { hydeSearch } from '../config/hyde';
import { rerankFoods, type RankedFood } from '../config/reranker';
import { filterByMetadata } from '../config/metadata-filter';
import { createSemanticCache } from '../config/semantic-cache';
import { embedderModel } from '../config/embedder';

type FoodSearchResult = SimilarFoodsResponse;

const foodSearchCache = createSemanticCache<FoodSearchResult>({ maxSize: 200, ttlMs: 10 * 60_000 });

let cacheHits = 0;
let cacheMisses = 0;

/**
 * Transforma SimilarFoodItem da API para formato da tool
 * API pode retornar strings (Decimal) — converte para number
 */
const toNum = (v: unknown): number => Number(v) || 0;

const formatFoodItem = (food: RankedFood) => ({
  id: String(food.id),
  name: String(food.name),
  category: food.category != null ? String(food.category) : 'Sem categoria',
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
export const searchFoodCatalogTool = withAuth({
  id: 'search-food-catalog',
  description:
    'Busca alimentos no catálogo nutricional por embedding semântico. Sempre agrupe todos os alimentos em uma única chamada passando um array. Nunca chame esta tool múltiplas vezes para buscar alimentos separados.',
  inputSchema: z.object({
    query: z
      .array(z.string())
      .min(1)
      .describe('Array com todos os alimentos a buscar de uma vez. Ex: ["arroz branco", "frango grelhado", "feijão"]. Nunca passe apenas um item se há mais alimentos para buscar.'),
    limit: z
      .number()
      .optional()
      .default(5)
      .describe('Número máximo de resultados (padrão: 5)'),
  }),
  outputSchema: searchFoodOutputSchema,
  execute: async (inputData, { authToken, userProfile }) => {
    const { query, limit = 5 } = inputData;

    logger.info(`🔍 [Tool] Buscando alimentos (semântica): "${query}" (limite: ${limit})`);

    try {
      const enrichedQuery = await Promise.all(
        query.map(async (q) => {
          if (q.trim().split(/\s+/).length > 3) {
            const enriched = await hydeSearch(q);
            logger.debug(`🧠 [HyDE] "${q}" → "${enriched}"`);
            return enriched;
          }
          return q;
        }),
      );

      const queryKey = enrichedQuery.join(' ');
      const { embeddings } = await embedderModel.doEmbed({ values: [queryKey] });
      const queryEmbedding = embeddings[0];

      let response = foodSearchCache.get(queryEmbedding);
      if (response !== null) {
        cacheHits++;
        const ratio = ((cacheHits / (cacheHits + cacheMisses)) * 100).toFixed(1);
        logger.info(`🎯 [SemanticCache] HIT — cache size: ${foodSearchCache.size()}, hit ratio: ${ratio}% (${cacheHits}/${cacheHits + cacheMisses})`);
      } else {
        cacheMisses++;
        const ratio = ((cacheHits / (cacheHits + cacheMisses)) * 100).toFixed(1);
        logger.info(`❌ [SemanticCache] MISS — cache size: ${foodSearchCache.size()}, hit ratio: ${ratio}% (${cacheHits}/${cacheHits + cacheMisses})`);
        response = await searchFoodsByEmbedding({ query: enrichedQuery, limit }, undefined, authToken);
        foodSearchCache.set(queryEmbedding, response);
      }

      const reranked = rerankFoods(response.similar_foods as any, query.join(' '), userProfile);
      const foods = reranked.map(formatFoodItem);

      const { filtered, removed, reasons, allRemovedWarning } = filterByMetadata(foods, userProfile);

      if (removed.length > 0) {
        removed.forEach((food) => {
          logger.info(`🚫 [Tool] Removido "${food.name}": ${reasons.get(food.name)}`);
        });
      }

      if (allRemovedWarning) {
        logger.warn(`⚠️ [Tool] ${allRemovedWarning}`);
      }

      logger.info(`✅ [Tool] Encontrados ${filtered.length} alimentos (${removed.length} removidos por restrições)`);

      const note = removed.length > 0
        ? `Nota: ${removed.length} alimento(s) foram removidos por restrições alimentares.`
        : allRemovedWarning;

      return {
        success: true,
        foods: filtered,
        count: filtered.length,
        ...(note && { note }),
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
