/**
 * Tool para confirmar e registrar refeição após análise de imagem
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { searchFoodsByEmbedding, logMeal } from "../clients/catalog-client";
import { extractAuthContext } from "../utils/auth-context";
import { logger } from "../../utils/logger";

const confirmAndLogImageMealToolInput = z.object({
  meal_type: z.enum(["breakfast", "lunch", "dinner", "snack"]).describe("Tipo"),
  detected_foods: z
    .array(
      z.object({
        food_name: z.string().describe("Nome"),
        quantity_g: z.number().describe("Gramas"),
        user_confirmed: z.boolean().default(true).describe("Confirmado"),
        user_adjusted_quantity_g: z.number().optional().describe("Ajustado"),
      }),
    )
    .min(1)
    .describe("Alimentos"),
  notes: z.string().optional().describe("Notas"),
});

const confirmAndLogImageMealToolOutput = z.object({
  meal_log_id: z.string().describe("ID"),
  total_calories: z.number().describe("Calorias"),
  total_protein_g: z.number().describe("Proteína"),
  total_carbs_g: z.number().describe("Carbos"),
  total_fat_g: z.number().describe("Gordura"),
  foods_logged: z.number().describe("Qtd"),
  catalog_matches: z
    .array(
      z.object({
        detected_name: z.string(),
        catalog_food: z.object({
          id: z.string(),
          name: z.string(),
          similarity: z.number(),
        }),
      }),
    )
    .describe("Matches"),
});

export const confirmAndLogImageMealTool = createTool({
  id: "confirm_and_log_image_meal",
  description:
    "Registra refeição após análise de imagem. Use APÓS analyze_food_image quando usuário confirmar. Busca alimentos com embeddings (semântica).",
  inputSchema: confirmAndLogImageMealToolInput,
  outputSchema: confirmAndLogImageMealToolOutput,
  execute: async (inputData, executionContext) => {
    const { meal_type, detected_foods, notes } = inputData;

    const { userId, authToken } = extractAuthContext(executionContext);

    if (userId === "anonymous") {
      throw new Error(
        "Usuário não autenticado. Por favor, faça login para registrar refeições.",
      );
    }

    logger.info(
      `🍽️ [Tool:confirmAndLogImageMeal] Registrando refeição de imagem para: ${userId}`,
    );
    logger.info(`   Tipo: ${meal_type}, Alimentos: ${detected_foods.length}`);

    // Busca todos os alimentos em paralelo (cosine similarity)
    const confirmedFoods = detected_foods.filter((f) => f.user_confirmed);
    const skippedCount = detected_foods.length - confirmedFoods.length;
    if (skippedCount > 0) {
      logger.info(`   ⊘ Pulando ${skippedCount} alimento(s) não confirmados`);
    }

    logger.info(
      `   🔎 Buscando ${confirmedFoods.length} alimento(s) em paralelo (semântica)...`,
    );

    const searchResults = await Promise.all(
      confirmedFoods.map(async (food) => {
        try {
          const searchResult = await searchFoodsByEmbedding(
            { query: food.food_name, limit: 1 },
            undefined,
            authToken,
          );
          return { food, searchResult, error: null };
        } catch (error) {
          return { food, searchResult: null, error };
        }
      }),
    );

    const catalogMatches = [];
    const foodsToLog = [];

    for (const { food, searchResult, error } of searchResults) {
      const quantity = food.user_adjusted_quantity_g || food.quantity_g;

      if (error) {
        logger.error(
          `   ❌ Erro ao buscar '${food.food_name}': ${error instanceof Error ? error.message : "Erro desconhecido"}`,
        );
        continue;
      }

      if (
        searchResult?.similar_foods &&
        searchResult.similar_foods.length > 0
      ) {
        const catalogFood = searchResult.similar_foods[0];

        logger.info(
          `   ✓ Match: '${catalogFood.name}' (ID: ${catalogFood.id}, score: ${catalogFood.similarity_score})`,
        );

        catalogMatches.push({
          detected_name: food.food_name,
          catalog_food: {
            id: catalogFood.id,
            name: catalogFood.name,
            similarity: catalogFood.similarity_score,
          },
        });

        foodsToLog.push({
          food_id: catalogFood.id,
          quantity_g: quantity,
          name: catalogFood.name,
        });
      } else {
        logger.warn(
          `   ⚠️ Nenhum match encontrado para '${food.food_name}'`,
        );
      }
    }

    if (foodsToLog.length === 0) {
      throw new Error(
        "Nenhum alimento foi encontrado no catálogo. Tente ser mais específico com os nomes.",
      );
    }

    // Registra a refeição completa
    logger.info(`   💾 Registrando ${foodsToLog.length} alimento(s)...`);

    try {
      const mealLog = await logMeal(
        {
          user_id: userId,
          meal_type,
          foods: foodsToLog,
          notes: notes || "Registrado via análise de imagem",
        },
        undefined,
        authToken,
      );

      logger.info(
        `   ✅ Refeição registrada! ID: ${mealLog.id}, Calorias: ${mealLog.total_calories} kcal`,
      );

      return {
        meal_log_id: mealLog.id,
        total_calories: mealLog.total_calories,
        total_protein_g: mealLog.total_protein_g,
        total_carbs_g: mealLog.total_carbs_g,
        total_fat_g: mealLog.total_fat_g,
        foods_logged: foodsToLog.length,
        catalog_matches: catalogMatches,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erro desconhecido";
      logger.error(`❌ [Tool:confirmAndLogImageMeal] Erro ao registrar: ${msg}`);
      throw new Error(
        `Não foi possível registrar a refeição: ${msg}. Os alimentos foram identificados corretamente, mas houve um erro no registro.`,
      );
    }
  },
});
