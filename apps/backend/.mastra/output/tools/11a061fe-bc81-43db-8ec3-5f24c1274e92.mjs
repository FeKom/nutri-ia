import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { f as deleteMealPlan } from '../catalog-client.mjs';
import { e as extractAuthContext, l as logger } from '../logger.mjs';
import '@mastra/core/request-context';
import 'node:async_hooks';
import 'pino';

const deleteMealPlanToolInput = z.object({
  plan_id: z.string().describe("ID do plano a deletar")
});
const deleteMealPlanToolOutput = z.object({
  success: z.boolean(),
  message: z.string()
});
const deleteMealPlanTool = createTool({
  id: "delete_meal_plan",
  description: "Deleta um plano alimentar. Use quando o usu\xE1rio pedir para excluir, remover, deletar um plano. Exemplos: 'Delete minha dieta antiga', 'Remove o plano X', 'Apaga essa dieta'",
  inputSchema: deleteMealPlanToolInput,
  outputSchema: deleteMealPlanToolOutput,
  execute: async (inputData, executionContext) => {
    const { plan_id } = inputData;
    const { userId, authToken } = extractAuthContext(executionContext);
    if (userId === "anonymous") {
      throw new Error(
        "Usu\xE1rio n\xE3o autenticado. Por favor, fa\xE7a login para deletar planos."
      );
    }
    logger.info(
      `\u{1F4CB} [Tool:deleteMealPlan] Deletando plano ${plan_id} para usu\xE1rio: ${userId}`
    );
    try {
      await deleteMealPlan(plan_id, userId, void 0, authToken);
      logger.info(`\u2705 [Tool:deleteMealPlan] Plano deletado com sucesso`);
      return {
        success: true,
        message: "Plano alimentar deletado com sucesso!"
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      logger.error(`\u274C [Tool:deleteMealPlan] Erro: ${errorMessage}`);
      throw new Error(
        `Erro ao deletar plano: ${errorMessage}. Verifique se o ID est\xE1 correto e se voc\xEA tem permiss\xE3o para deletar este plano.`
      );
    }
  }
});

export { deleteMealPlanTool };
