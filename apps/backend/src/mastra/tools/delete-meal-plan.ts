import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { deleteMealPlan } from "../clients/catalog-client";
import { extractAuthContext } from "../utils/auth-context";
import { logger } from "../../utils/logger";

const deleteMealPlanToolInput = z.object({
  plan_id: z.string().describe("ID do plano a deletar"),
});

const deleteMealPlanToolOutput = z.object({
  success: z.boolean(),
  message: z.string(),
});

export const deleteMealPlanTool = createTool({
  id: "delete_meal_plan",
  description:
    "Deleta um plano alimentar. " +
    "Use quando o usuário pedir para excluir, remover, deletar um plano. " +
    "Exemplos: 'Delete minha dieta antiga', 'Remove o plano X', 'Apaga essa dieta'",
  inputSchema: deleteMealPlanToolInput,
  outputSchema: deleteMealPlanToolOutput,
  execute: async (inputData, executionContext) => {
    const { plan_id } = inputData;

    const { userId, authToken } = extractAuthContext(executionContext);

    if (userId === "anonymous") {
      throw new Error(
        "Usuário não autenticado. Por favor, faça login para deletar planos.",
      );
    }

    logger.info(
      `📋 [Tool:deleteMealPlan] Deletando plano ${plan_id} para usuário: ${userId}`,
    );

    try {
      await deleteMealPlan(plan_id, userId, undefined, authToken);

      logger.info(`✅ [Tool:deleteMealPlan] Plano deletado com sucesso`);

      return {
        success: true,
        message: "Plano alimentar deletado com sucesso!",
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Erro desconhecido";
      logger.error(`❌ [Tool:deleteMealPlan] Erro: ${errorMessage}`);

      throw new Error(
        `Erro ao deletar plano: ${errorMessage}. Verifique se o ID está correto e se você tem permissão para deletar este plano.`,
      );
    }
  },
});
