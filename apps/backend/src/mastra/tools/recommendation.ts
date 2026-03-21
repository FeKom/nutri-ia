import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import {
  defaultConfig,
  getRecommendations,
  type RecommendedFoodItem,
} from "../clients/catalog-client";
import { recommendationOutputSchema } from "../schemas/output";
import { logger } from "../../utils/logger";
import { extractAuthContext } from "../utils/auth-context";

/**
 * Transforma RecommendedFoodItem da API para formato da tool
 */
const formatRecommendedFood = (food: RecommendedFoodItem) => ({
  id: food.id,
  name: food.name,
  category: food.category ?? "Sem categoria",
  portion: `${food.serving_size_g}${food.serving_unit ?? "g"}`,
  nutrition: {
    calories: food.calorie_per_100g ?? 0,
    protein_g: food.protein_g_100g ?? 0,
    carbs_g: food.carbs_g_100g ?? 0,
    fat_g: food.fat_g_100g ?? 0,
  },
  source: food.source,
  is_verified: food.is_verified,
});

/**
 * Tool para obter recomendações personalizadas de alimentos
 * Considera restrições alimentares, alergias e preferências do usuário
 */
export const recommendationTool = createTool({
  id: "get-recommendations",
  description:
    "Obtém recomendações personalizadas de alimentos para um usuário com base em seu perfil. " +
    "Considera restrições alimentares, alergias e alimentos que o usuário não gosta. " +
    "Pode filtrar por categoria de alimento.",
  inputSchema: z.object({
    // user_id é obtido automaticamente do contexto (resourceId)
    limit: z
      .number()
      .optional()
      .default(20)
      .describe("Número máximo de recomendações (padrão: 20)"),
    category: z
      .string()
      .optional()
      .describe(
        'Categoria de alimento para filtrar (ex: "protein", "vegetable", "fruit")',
      ),
  }),
  outputSchema: recommendationOutputSchema,
  execute: async (inputData, executionContext) => {
    const { limit = 20, category } = inputData;

    // Pega user_id e JWT do requestContext (definido no endpoint /chat)
    const { userId, authToken } = extractAuthContext(executionContext);
    logger.info(
      `🎯 [Tool] Buscando recomendações para usuário: "${userId}"${category ? ` (categoria: ${category})` : ""}`,
    );

    try {
      const response = await getRecommendations(
        {
          user_id: userId,
          limit,
          ...(category && { category }),
        },
        defaultConfig,
        authToken,
      );

      const foods = response.foods.map(formatRecommendedFood);

      logger.info(`✅ [Tool] Encontradas ${foods.length} recomendações`);

      return {
        success: true,
        foods,
        count: foods.length,
        filters_applied: response.filters_applied,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Erro desconhecido";

      logger.error(`❌ [Tool] Erro nas recomendações: ${errorMessage}`);

      return {
        success: false,
        foods: [],
        count: 0,
        filters_applied: {
          dietary_restrictions: [],
          allergies: [],
          disliked_foods: [],
        },
        error: `Não foi possível obter recomendações: ${errorMessage}`,
      };
    }
  },
});
