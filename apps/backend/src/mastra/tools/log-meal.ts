/**
 * Tool para registrar refeições consumidas
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { logMeal } from "../clients/catalog-client";
import { extractAuthContext } from "../utils/auth-context";
import { logger } from "../../utils/logger";

const logMealToolInput = z.object({
  // user_id é obtido automaticamente do contexto (resourceId)
  meal_type: z
    .enum(["breakfast", "lunch", "dinner", "snack"])
    .describe("Tipo de refeição (breakfast, lunch, dinner, snack)"),
  foods: z
    .array(
      z.object({
        food_id: z.string().describe("ID do alimento"),
        quantity_g: z.number().positive().describe("Quantidade em gramas"),
        name: z.string().optional().describe("Nome do alimento (opcional)"),
      }),
    )
    .min(1)
    .describe("Lista de alimentos consumidos"),
  notes: z.string().optional().describe("Notas sobre a refeição (opcional)"),
});

export const logMealTool = createTool({
  id: "log_meal",
  description:
    "Registra uma refeição consumida pelo usuário com todos os alimentos e quantidades. " +
    "Calcula automaticamente os totais nutricionais e atualiza as estatísticas diárias. " +
    "Use esta ferramenta quando o usuário disser que comeu, consumiu ou registrou uma refeição. " +
    "Exemplos: 'Comi 2 ovos no café da manhã', 'Registrar almoço com arroz e feijão'",
  inputSchema: logMealToolInput,
  outputSchema: z.object({
    id: z.string().describe("ID do registro da refeição"),
    total_calories: z.number().describe("Total de calorias da refeição"),
    total_protein_g: z.number().describe("Total de proteína em gramas"),
    total_carbs_g: z.number().describe("Total de carboidratos em gramas"),
    total_fat_g: z.number().describe("Total de gordura em gramas"),
    meal_type: z.string().describe("Tipo de refeição"),
    num_foods: z.number().describe("Número de alimentos na refeição"),
  }),
  execute: async (inputData, executionContext) => {
    // Desestrutura parâmetros do inputData
    const { meal_type, foods, notes } = inputData;

    const { userId, authToken } = extractAuthContext(executionContext);

    logger.info(`🍽️ [Tool:logMeal] Registrando refeição para usuário: ${userId}`);
    logger.info(`   Tipo: ${meal_type}, Alimentos: ${foods.length}`);

    try {
      const result = await logMeal(
        {
          user_id: userId,
          meal_type,
          foods,
          notes,
        },
        undefined,
        authToken,
      );
      return {
        id: result.id,
        total_calories: result.total_calories,
        total_protein_g: result.total_protein_g,
        total_carbs_g: result.total_carbs_g,
        total_fat_g: result.total_fat_g,
        meal_type: result.meal_type,
        num_foods: result.foods.length,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erro desconhecido";
      logger.error(`❌ [Tool:logMeal] Erro: ${msg}`);
      return {
        id: "",
        total_calories: 0,
        total_protein_g: 0,
        total_carbs_g: 0,
        total_fat_g: 0,
        meal_type,
        num_foods: 0,
      };
    }
  },
});
