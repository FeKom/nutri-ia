/**
 * Tool para obter resumo nutricional do dia
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getDailySummary } from "../clients/catalog-client";
import { extractAuthContext } from "../utils/auth-context";
import { logger } from "../../utils/logger";

const getDailySummaryToolInput = z.object({
  // user_id é obtido automaticamente do contexto (resourceId)
  date: z
    .string()
    .optional()
    .describe("Data no formato YYYY-MM-DD (opcional, padrão: hoje)"),
});

export const getDailySummaryTool = createTool({
  id: "get_daily_summary",
  description:
    "Obtém o resumo nutricional completo do dia para um usuário, incluindo: " +
    "- Todas as refeições registradas " +
    "- Totais de calorias e macronutrientes consumidos " +
    "- Metas nutricionais do usuário " +
    "- Progresso em relação às metas (percentuais) " +
    "- Número de refeições feitas " +
    "Use quando o usuário perguntar sobre seu dia, progresso ou consumo diário. " +
    "Exemplos: 'Como está meu dia hoje?', 'Quantas calorias já consumi?', 'Estou dentro das minhas metas?'",
  inputSchema: getDailySummaryToolInput,
  outputSchema: z.object({
    date: z.string().describe("Data do resumo"),
    num_meals: z.number().describe("Número de refeições registradas"),
    totals: z.object({
      calories: z.number(),
      protein_g: z.number(),
      carbs_g: z.number(),
      fat_g: z.number(),
    }),
    targets: z.object({
      calories: z.number(),
      protein_g: z.number(),
      carbs_g: z.number(),
      fat_g: z.number(),
    }),
    progress: z.object({
      calories_pct: z.number().describe("Porcentagem da meta de calorias"),
      protein_pct: z.number().describe("Porcentagem da meta de proteína"),
      carbs_pct: z.number().describe("Porcentagem da meta de carboidratos"),
      fat_pct: z.number().describe("Porcentagem da meta de gordura"),
    }),
    meals: z.array(
      z.object({
        id: z.string(),
        meal_type: z.string(),
        total_calories: z.number(),
        total_protein_g: z.number(),
        total_carbs_g: z.number(),
        total_fat_g: z.number(),
      }),
    ),
  }),
  execute: async (inputData, executionContext) => {
    // Desestrutura parâmetros do inputData
    const { date } = inputData;

    const { userId, authToken } = extractAuthContext(executionContext);

    logger.info(`📈 [Tool:getDailySummary] Obtendo resumo para usuário: ${userId} (data: ${date || "hoje"})`);

    try {
      const result = await getDailySummary(userId, date, undefined, authToken);
      return {
        date: result.date,
        num_meals: result.num_meals,
        totals: result.totals,
        targets: result.targets,
        progress: result.progress,
        meals: result.meals.map((meal) => ({
          id: meal.id,
          meal_type: meal.meal_type,
          total_calories: meal.total_calories,
          total_protein_g: meal.total_protein_g,
          total_carbs_g: meal.total_carbs_g,
          total_fat_g: meal.total_fat_g,
        })),
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erro desconhecido";
      logger.error(`❌ [Tool:getDailySummary] Erro: ${msg}`);
      return {
        date: date || new Date().toISOString().split("T")[0],
        num_meals: 0,
        totals: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
        targets: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
        progress: { calories_pct: 0, protein_pct: 0, carbs_pct: 0, fat_pct: 0 },
        meals: [],
      };
    }
  },
});
