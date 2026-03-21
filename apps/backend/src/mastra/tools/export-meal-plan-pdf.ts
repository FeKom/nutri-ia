import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getMealPlan } from "../clients/catalog-client";
import { extractAuthContext } from "../utils/auth-context";
import { logger } from "../../utils/logger";

const exportMealPlanPdfToolInput = z.object({
  plan_id: z.string().describe("ID do plano alimentar para exportar como PDF"),
});

const exportMealPlanPdfToolOutput = z.object({
  success: z.boolean(),
  plan_name: z.string(),
  download_url: z.string(),
  message: z.string(),
});

export const exportMealPlanPdfTool = createTool({
  id: "export_meal_plan_pdf",
  description:
    "Exporta um plano alimentar como PDF para download. " +
    "Use quando o usuário pedir para gerar, exportar ou baixar o PDF de uma dieta ou plano alimentar. " +
    "Exemplos: 'gera um PDF da minha dieta', 'exporta meu plano alimentar', 'quero baixar minha dieta em PDF'",
  inputSchema: exportMealPlanPdfToolInput,
  outputSchema: exportMealPlanPdfToolOutput,
  execute: async (inputData, executionContext) => {
    const { plan_id } = inputData;

    const { userId, authToken } = extractAuthContext(executionContext);

    if (userId === "anonymous") {
      throw new Error(
        "Usuário não autenticado. Por favor, faça login para exportar planos.",
      );
    }

    logger.info(
      `📄 [Tool:exportMealPlanPdf] Exportando plano ${plan_id} para usuário: ${userId}`,
    );

    try {
      const plan = await getMealPlan(plan_id, userId, undefined, authToken);

      logger.info(
        `✅ [Tool:exportMealPlanPdf] Plano encontrado: "${plan.plan_name}", gerando link de download`,
      );

      const download_url = `/api/meal-plans/${plan_id}/pdf`;

      return {
        success: true,
        plan_name: plan.plan_name,
        download_url,
        message: `PDF do plano "${plan.plan_name}" pronto para download.`,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Erro desconhecido";
      logger.error(`❌ [Tool:exportMealPlanPdf] Erro: ${errorMessage}`);

      throw new Error(
        `Erro ao exportar plano como PDF: ${errorMessage}. Verifique se o ID está correto e se você tem permissão para acessar este plano.`,
      );
    }
  },
});
