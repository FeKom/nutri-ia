import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { m as getRecommendations, e as defaultConfig } from '../catalog-client.mjs';
import { r as recommendationOutputSchema } from '../output.mjs';
import { e as extractAuthContext, l as logger } from '../logger.mjs';
import '@mastra/core/request-context';
import 'node:async_hooks';
import 'pino';

const formatRecommendedFood = (food) => ({
  id: food.id,
  name: food.name,
  category: food.category ?? "Sem categoria",
  portion: `${food.serving_size_g}${food.serving_unit ?? "g"}`,
  nutrition: {
    calories: food.calorie_per_100g ?? 0,
    protein_g: food.protein_g_100g ?? 0,
    carbs_g: food.carbs_g_100g ?? 0,
    fat_g: food.fat_g_100g ?? 0
  },
  source: food.source,
  is_verified: food.is_verified
});
const recommendationTool = createTool({
  id: "get-recommendations",
  description: "Obt\xE9m recomenda\xE7\xF5es personalizadas de alimentos para um usu\xE1rio com base em seu perfil. Considera restri\xE7\xF5es alimentares, alergias e alimentos que o usu\xE1rio n\xE3o gosta. Pode filtrar por categoria de alimento.",
  inputSchema: z.object({
    // user_id é obtido automaticamente do contexto (resourceId)
    limit: z.number().optional().default(20).describe("N\xFAmero m\xE1ximo de recomenda\xE7\xF5es (padr\xE3o: 20)"),
    category: z.string().optional().describe(
      'Categoria de alimento para filtrar (ex: "protein", "vegetable", "fruit")'
    )
  }),
  outputSchema: recommendationOutputSchema,
  execute: async (inputData, executionContext) => {
    const { limit = 20, category } = inputData;
    const { userId, authToken } = extractAuthContext(executionContext);
    logger.info(
      `\u{1F3AF} [Tool] Buscando recomenda\xE7\xF5es para usu\xE1rio: "${userId}"${category ? ` (categoria: ${category})` : ""}`
    );
    try {
      const response = await getRecommendations(
        {
          user_id: userId,
          limit,
          ...category && { category }
        },
        defaultConfig,
        authToken
      );
      const foods = response.foods.map(formatRecommendedFood);
      logger.info(`\u2705 [Tool] Encontradas ${foods.length} recomenda\xE7\xF5es`);
      return {
        success: true,
        foods,
        count: foods.length,
        filters_applied: response.filters_applied
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      logger.error(`\u274C [Tool] Erro nas recomenda\xE7\xF5es: ${errorMessage}`);
      return {
        success: false,
        foods: [],
        count: 0,
        filters_applied: {
          dietary_restrictions: [],
          allergies: [],
          disliked_foods: []
        },
        error: `N\xE3o foi poss\xEDvel obter recomenda\xE7\xF5es: ${errorMessage}`
      };
    }
  }
});

export { recommendationTool };
