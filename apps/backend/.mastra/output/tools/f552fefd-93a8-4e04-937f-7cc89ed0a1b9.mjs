import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { i as getDailySummary } from '../catalog-client.mjs';
import { e as extractAuthContext, l as logger } from '../logger.mjs';
import '@mastra/core/request-context';
import 'node:async_hooks';
import 'pino';

const getDailySummaryToolInput = z.object({
  // user_id é obtido automaticamente do contexto (resourceId)
  date: z.string().optional().describe("Data no formato YYYY-MM-DD (opcional, padr\xE3o: hoje)")
});
const getDailySummaryTool = createTool({
  id: "get_daily_summary",
  description: "Obt\xE9m o resumo nutricional completo do dia para um usu\xE1rio, incluindo: - Todas as refei\xE7\xF5es registradas - Totais de calorias e macronutrientes consumidos - Metas nutricionais do usu\xE1rio - Progresso em rela\xE7\xE3o \xE0s metas (percentuais) - N\xFAmero de refei\xE7\xF5es feitas Use quando o usu\xE1rio perguntar sobre seu dia, progresso ou consumo di\xE1rio. Exemplos: 'Como est\xE1 meu dia hoje?', 'Quantas calorias j\xE1 consumi?', 'Estou dentro das minhas metas?'",
  inputSchema: getDailySummaryToolInput,
  outputSchema: z.object({
    date: z.string().describe("Data do resumo"),
    num_meals: z.number().describe("N\xFAmero de refei\xE7\xF5es registradas"),
    totals: z.object({
      calories: z.number(),
      protein_g: z.number(),
      carbs_g: z.number(),
      fat_g: z.number()
    }),
    targets: z.object({
      calories: z.number(),
      protein_g: z.number(),
      carbs_g: z.number(),
      fat_g: z.number()
    }),
    progress: z.object({
      calories_pct: z.number().describe("Porcentagem da meta de calorias"),
      protein_pct: z.number().describe("Porcentagem da meta de prote\xEDna"),
      carbs_pct: z.number().describe("Porcentagem da meta de carboidratos"),
      fat_pct: z.number().describe("Porcentagem da meta de gordura")
    }),
    meals: z.array(
      z.object({
        id: z.string(),
        meal_type: z.string(),
        total_calories: z.number(),
        total_protein_g: z.number(),
        total_carbs_g: z.number(),
        total_fat_g: z.number()
      })
    )
  }),
  execute: async (inputData, executionContext) => {
    const { date } = inputData;
    const { userId, authToken } = extractAuthContext(executionContext);
    logger.info(`\u{1F4C8} [Tool:getDailySummary] Obtendo resumo para usu\xE1rio: ${userId} (data: ${date || "hoje"})`);
    try {
      const result = await getDailySummary(userId, date, void 0, authToken);
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
          total_fat_g: meal.total_fat_g
        }))
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erro desconhecido";
      logger.error(`\u274C [Tool:getDailySummary] Erro: ${msg}`);
      return {
        date: date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
        num_meals: 0,
        totals: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
        targets: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
        progress: { calories_pct: 0, protein_pct: 0, carbs_pct: 0, fat_pct: 0 },
        meals: []
      };
    }
  }
});

export { getDailySummaryTool };
