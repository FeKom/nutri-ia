import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { g as getMealPlan } from '../catalog-client.mjs';
import { e as extractAuthContext, l as logger } from '../logger.mjs';
import '@mastra/core/request-context';
import 'node:async_hooks';
import 'pino';

const exportMealPlanPdfToolInput = z.object({
  plan_id: z.string().describe("ID do plano alimentar para exportar como PDF")
});
const exportMealPlanPdfToolOutput = z.object({
  success: z.boolean(),
  plan_name: z.string(),
  download_url: z.string(),
  message: z.string()
});
const exportMealPlanPdfTool = createTool({
  id: "export_meal_plan_pdf",
  description: "Exporta um plano alimentar como PDF para download. Use quando o usu\xE1rio pedir para gerar, exportar ou baixar o PDF de uma dieta ou plano alimentar. Exemplos: 'gera um PDF da minha dieta', 'exporta meu plano alimentar', 'quero baixar minha dieta em PDF'",
  inputSchema: exportMealPlanPdfToolInput,
  outputSchema: exportMealPlanPdfToolOutput,
  execute: async (inputData, executionContext) => {
    const { plan_id } = inputData;
    const { userId, authToken } = extractAuthContext(executionContext);
    if (userId === "anonymous") {
      throw new Error(
        "Usu\xE1rio n\xE3o autenticado. Por favor, fa\xE7a login para exportar planos."
      );
    }
    logger.info(
      `\u{1F4C4} [Tool:exportMealPlanPdf] Exportando plano ${plan_id} para usu\xE1rio: ${userId}`
    );
    try {
      const plan = await getMealPlan(plan_id, userId, void 0, authToken);
      logger.info(
        `\u2705 [Tool:exportMealPlanPdf] Plano encontrado: "${plan.plan_name}", gerando link de download`
      );
      const download_url = `/api/meal-plans/${plan_id}/pdf`;
      return {
        success: true,
        plan_name: plan.plan_name,
        download_url,
        message: `PDF do plano "${plan.plan_name}" pronto para download.`
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      logger.error(`\u274C [Tool:exportMealPlanPdf] Erro: ${errorMessage}`);
      throw new Error(
        `Erro ao exportar plano como PDF: ${errorMessage}. Verifique se o ID est\xE1 correto e se voc\xEA tem permiss\xE3o para acessar este plano.`
      );
    }
  }
});

export { exportMealPlanPdfTool };
