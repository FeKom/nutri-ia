/**
 * Tool para obter estatísticas semanais
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getWeeklyStats } from "../clients/catalog-client";
import { extractAuthContext } from "../utils/auth-context";
import { logger } from "../../utils/logger";

const getWeeklyStatsToolInput = z.object({
  // user_id é obtido automaticamente do contexto (resourceId)
  days: z
    .number()
    .int()
    .min(1)
    .max(30)
    .optional()
    .default(7)
    .describe("Número de dias para incluir (1-30, padrão: 7)"),
});

export const getWeeklyStatsTool = createTool({
  id: "get_weekly_stats",
  description:
    "Obtém estatísticas nutricionais agregadas de um período (padrão: últimos 7 dias), incluindo: " +
    "- Estatísticas diárias detalhadas " +
    "- Médias de calorias e macronutrientes " +
    "- Taxa de aderência (% de dias com refeições registradas) " +
    "- Tendências e padrões alimentares " +
    "Use quando o usuário perguntar sobre sua semana, tendências ou evolução. " +
    "Exemplos: 'Como foi minha semana?', 'Estou melhorando?', 'Qual minha média de calorias?'",
  inputSchema: getWeeklyStatsToolInput,
  outputSchema: z.object({
    user_id: z.string(),
    num_days: z.number().describe("Número de dias com dados"),
    averages: z.object({
      calories: z.number().describe("Média diária de calorias"),
      protein_g: z.number().describe("Média diária de proteína"),
      carbs_g: z.number().describe("Média diária de carboidratos"),
      fat_g: z.number().describe("Média diária de gordura"),
    }),
    adherence_rate: z
      .number()
      .describe("Taxa de aderência (% de dias com registro)"),
    stats: z.array(
      z.object({
        date: z.string(),
        total_calories: z.number(),
        total_protein_g: z.number(),
        total_carbs_g: z.number(),
        total_fat_g: z.number(),
        num_meals: z.number(),
      }),
    ),
  }),
  execute: async (inputData, executionContext) => {
    // Desestrutura parâmetros do inputData
    const { days = 7 } = inputData;

    const { userId, authToken } = extractAuthContext(executionContext);

    logger.info(`📊 [Tool:getWeeklyStats] Obtendo estatísticas para usuário: ${userId} (dias: ${days})`);

    try {
      const result = await getWeeklyStats(userId, days, undefined, authToken);
      return {
        user_id: result.user_id,
        num_days: result.stats.length,
        averages: result.averages,
        adherence_rate: result.adherence_rate,
        stats: result.stats.map((stat) => ({
          date: stat.date,
          total_calories: stat.total_calories,
          total_protein_g: stat.total_protein_g,
          total_carbs_g: stat.total_carbs_g,
          total_fat_g: stat.total_fat_g,
          num_meals: stat.num_meals,
        })),
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erro desconhecido";
      logger.error(`❌ [Tool:getWeeklyStats] Erro: ${msg}`);
      return {
        user_id: userId,
        num_days: 0,
        averages: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
        adherence_rate: 0,
        stats: [],
      };
    }
  },
});
