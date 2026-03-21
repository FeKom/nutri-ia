import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { s as searchFoodsByEmbedding, l as logMeal } from '../catalog-client.mjs';
import { e as extractAuthContext, l as logger } from '../logger.mjs';
import '@mastra/core/request-context';
import 'node:async_hooks';
import 'pino';

const confirmAndLogImageMealToolInput = z.object({
  meal_type: z.enum(["breakfast", "lunch", "dinner", "snack"]).describe("Tipo"),
  detected_foods: z.array(
    z.object({
      food_name: z.string().describe("Nome"),
      quantity_g: z.number().describe("Gramas"),
      user_confirmed: z.boolean().default(true).describe("Confirmado"),
      user_adjusted_quantity_g: z.number().optional().describe("Ajustado")
    })
  ).min(1).describe("Alimentos"),
  notes: z.string().optional().describe("Notas")
});
const confirmAndLogImageMealToolOutput = z.object({
  meal_log_id: z.string().describe("ID"),
  total_calories: z.number().describe("Calorias"),
  total_protein_g: z.number().describe("Prote\xEDna"),
  total_carbs_g: z.number().describe("Carbos"),
  total_fat_g: z.number().describe("Gordura"),
  foods_logged: z.number().describe("Qtd"),
  catalog_matches: z.array(
    z.object({
      detected_name: z.string(),
      catalog_food: z.object({
        id: z.string(),
        name: z.string(),
        similarity: z.number()
      })
    })
  ).describe("Matches")
});
const confirmAndLogImageMealTool = createTool({
  id: "confirm_and_log_image_meal",
  description: "Registra refei\xE7\xE3o ap\xF3s an\xE1lise de imagem. Use AP\xD3S analyze_food_image quando usu\xE1rio confirmar. Busca alimentos com embeddings (sem\xE2ntica).",
  inputSchema: confirmAndLogImageMealToolInput,
  outputSchema: confirmAndLogImageMealToolOutput,
  execute: async (inputData, executionContext) => {
    const { meal_type, detected_foods, notes } = inputData;
    const { userId, authToken } = extractAuthContext(executionContext);
    if (userId === "anonymous") {
      throw new Error(
        "Usu\xE1rio n\xE3o autenticado. Por favor, fa\xE7a login para registrar refei\xE7\xF5es."
      );
    }
    logger.info(
      `\u{1F37D}\uFE0F [Tool:confirmAndLogImageMeal] Registrando refei\xE7\xE3o de imagem para: ${userId}`
    );
    logger.info(`   Tipo: ${meal_type}, Alimentos: ${detected_foods.length}`);
    const confirmedFoods = detected_foods.filter((f) => f.user_confirmed);
    const skippedCount = detected_foods.length - confirmedFoods.length;
    if (skippedCount > 0) {
      logger.info(`   \u2298 Pulando ${skippedCount} alimento(s) n\xE3o confirmados`);
    }
    logger.info(
      `   \u{1F50E} Buscando ${confirmedFoods.length} alimento(s) em paralelo (sem\xE2ntica)...`
    );
    const searchResults = await Promise.all(
      confirmedFoods.map(async (food) => {
        try {
          const searchResult = await searchFoodsByEmbedding(
            { query: food.food_name, limit: 1 },
            void 0,
            authToken
          );
          return { food, searchResult, error: null };
        } catch (error) {
          return { food, searchResult: null, error };
        }
      })
    );
    const catalogMatches = [];
    const foodsToLog = [];
    for (const { food, searchResult, error } of searchResults) {
      const quantity = food.user_adjusted_quantity_g || food.quantity_g;
      if (error) {
        logger.error(
          `   \u274C Erro ao buscar '${food.food_name}': ${error instanceof Error ? error.message : "Erro desconhecido"}`
        );
        continue;
      }
      if (searchResult?.similar_foods && searchResult.similar_foods.length > 0) {
        const catalogFood = searchResult.similar_foods[0];
        logger.info(
          `   \u2713 Match: '${catalogFood.name}' (ID: ${catalogFood.id}, score: ${catalogFood.similarity_score})`
        );
        catalogMatches.push({
          detected_name: food.food_name,
          catalog_food: {
            id: catalogFood.id,
            name: catalogFood.name,
            similarity: catalogFood.similarity_score
          }
        });
        foodsToLog.push({
          food_id: catalogFood.id,
          quantity_g: quantity,
          name: catalogFood.name
        });
      } else {
        logger.warn(
          `   \u26A0\uFE0F Nenhum match encontrado para '${food.food_name}'`
        );
      }
    }
    if (foodsToLog.length === 0) {
      throw new Error(
        "Nenhum alimento foi encontrado no cat\xE1logo. Tente ser mais espec\xEDfico com os nomes."
      );
    }
    logger.info(`   \u{1F4BE} Registrando ${foodsToLog.length} alimento(s)...`);
    try {
      const mealLog = await logMeal(
        {
          user_id: userId,
          meal_type,
          foods: foodsToLog,
          notes: notes || "Registrado via an\xE1lise de imagem"
        },
        void 0,
        authToken
      );
      logger.info(
        `   \u2705 Refei\xE7\xE3o registrada! ID: ${mealLog.id}, Calorias: ${mealLog.total_calories} kcal`
      );
      return {
        meal_log_id: mealLog.id,
        total_calories: mealLog.total_calories,
        total_protein_g: mealLog.total_protein_g,
        total_carbs_g: mealLog.total_carbs_g,
        total_fat_g: mealLog.total_fat_g,
        foods_logged: foodsToLog.length,
        catalog_matches: catalogMatches
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erro desconhecido";
      logger.error(`\u274C [Tool:confirmAndLogImageMeal] Erro ao registrar: ${msg}`);
      throw new Error(
        `N\xE3o foi poss\xEDvel registrar a refei\xE7\xE3o: ${msg}. Os alimentos foram identificados corretamente, mas houve um erro no registro.`
      );
    }
  }
});

export { confirmAndLogImageMealTool };
