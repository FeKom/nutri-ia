import { withAuth } from "../../../utils/with-auth";
import { z } from "zod";
import { weeklyProgressReportWorkflow } from "../../../workflows/weekly-progress-report";
import { logger } from "../../../../utils/logger";

const weeklyProgressReportToolInput = z.object({
  days: z
    .number()
    .int()
    .min(1)
    .max(30)
    .optional()
    .default(7)
    .describe("Número de dias do período a analisar (padrão: 7, máx: 30)"),
});

const weeklyProgressReportToolOutput = z.object({
  period_days: z.number(),
  adherence_rate: z.number(),
  averages: z.object({
    calories: z.number(),
    protein_g: z.number(),
    carbs_g: z.number(),
    fat_g: z.number(),
  }),
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
  today: z
    .object({
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
        calories_pct: z.number(),
        protein_pct: z.number(),
        carbs_pct: z.number(),
        fat_pct: z.number(),
      }),
      num_meals: z.number(),
    })
    .nullable(),
  weakest_nutrient: z.string(),
  recommendations: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      category: z.string(),
      nutrition: z.object({
        calories_per_100g: z.number(),
        protein_g: z.number(),
        carbs_g: z.number(),
        fat_g: z.number(),
      }),
    }),
  ),
  message: z.string(),
});

export const weeklyProgressReportTool = withAuth({
  id: "weekly_progress_report",
  description:
    "Gera um relatório completo de progresso nutricional do período (padrão: 7 dias). " +
    "Busca estatísticas semanais, resumo de hoje e recomendações personalizadas em uma única operação. " +
    "Use quando o usuário perguntar sobre sua semana, evolução, tendências ou quiser uma visão geral do período. " +
    "Exemplos: 'como foi minha semana?', 'estou melhorando?', 'me dá um resumo dos últimos 7 dias', 'o que devo comer para melhorar?'",
  inputSchema: weeklyProgressReportToolInput,
  outputSchema: weeklyProgressReportToolOutput,
  execute: async (inputData, { userId, authToken }) => {
    const { days = 7 } = inputData;

    if (userId === "anonymous") {
      throw new Error(
        "Usuário não autenticado. Por favor, faça login para ver seu relatório de progresso.",
      );
    }

    logger.info(
      `[Tool:weeklyProgressReport] Triggering workflow for user ${userId} (days: ${days})`,
    );

    const run = await weeklyProgressReportWorkflow.createRun();
    const result = await run.start({
      inputData: {
        days,
        userId,
        authToken: authToken ?? "",
      },
    });

    if (result.status !== "success") {
      const err = (result as any).error ?? "Erro desconhecido no workflow";
      logger.error(`[Tool:weeklyProgressReport] Workflow failed: ${err}`);
      throw new Error(`Erro ao gerar relatório de progresso: ${err}`);
    }

    const output = result.result;

    logger.info(
      `[Tool:weeklyProgressReport] Workflow completed — ${output.period_days} day(s), ${output.recommendations.length} recommendation(s)`,
    );

    return {
      period_days: output.period_days,
      adherence_rate: output.adherence_rate,
      averages: output.averages,
      stats: output.stats,
      today: output.today
        ? {
            totals: output.today.totals,
            targets: output.today.targets,
            progress: output.today.progress,
            num_meals: output.today.num_meals,
          }
        : null,
      weakest_nutrient: output.weakest_nutrient,
      recommendations: output.recommendations,
      message: output.message,
    };
  },
});
