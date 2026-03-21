import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { j as getWeeklyStats } from '../catalog-client.mjs';
import { e as extractAuthContext, l as logger } from '../logger.mjs';
import '@mastra/core/request-context';
import 'node:async_hooks';
import 'pino';

const getWeeklyStatsToolInput = z.object({
  // user_id é obtido automaticamente do contexto (resourceId)
  days: z.number().int().min(1).max(30).optional().default(7).describe("N\xFAmero de dias para incluir (1-30, padr\xE3o: 7)")
});
const getWeeklyStatsTool = createTool({
  id: "get_weekly_stats",
  description: "Obt\xE9m estat\xEDsticas nutricionais agregadas de um per\xEDodo (padr\xE3o: \xFAltimos 7 dias), incluindo: - Estat\xEDsticas di\xE1rias detalhadas - M\xE9dias de calorias e macronutrientes - Taxa de ader\xEAncia (% de dias com refei\xE7\xF5es registradas) - Tend\xEAncias e padr\xF5es alimentares Use quando o usu\xE1rio perguntar sobre sua semana, tend\xEAncias ou evolu\xE7\xE3o. Exemplos: 'Como foi minha semana?', 'Estou melhorando?', 'Qual minha m\xE9dia de calorias?'",
  inputSchema: getWeeklyStatsToolInput,
  outputSchema: z.object({
    user_id: z.string(),
    num_days: z.number().describe("N\xFAmero de dias com dados"),
    averages: z.object({
      calories: z.number().describe("M\xE9dia di\xE1ria de calorias"),
      protein_g: z.number().describe("M\xE9dia di\xE1ria de prote\xEDna"),
      carbs_g: z.number().describe("M\xE9dia di\xE1ria de carboidratos"),
      fat_g: z.number().describe("M\xE9dia di\xE1ria de gordura")
    }),
    adherence_rate: z.number().describe("Taxa de ader\xEAncia (% de dias com registro)"),
    stats: z.array(
      z.object({
        date: z.string(),
        total_calories: z.number(),
        total_protein_g: z.number(),
        total_carbs_g: z.number(),
        total_fat_g: z.number(),
        num_meals: z.number()
      })
    )
  }),
  execute: async (inputData, executionContext) => {
    const { days = 7 } = inputData;
    const { userId, authToken } = extractAuthContext(executionContext);
    logger.info(`\u{1F4CA} [Tool:getWeeklyStats] Obtendo estat\xEDsticas para usu\xE1rio: ${userId} (dias: ${days})`);
    try {
      const result = await getWeeklyStats(userId, days, void 0, authToken);
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
          num_meals: stat.num_meals
        }))
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erro desconhecido";
      logger.error(`\u274C [Tool:getWeeklyStats] Erro: ${msg}`);
      return {
        user_id: userId,
        num_days: 0,
        averages: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
        adherence_rate: 0,
        stats: []
      };
    }
  }
});

export { getWeeklyStatsTool };
