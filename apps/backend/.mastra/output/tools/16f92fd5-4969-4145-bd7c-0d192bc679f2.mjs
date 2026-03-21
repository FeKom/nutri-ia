import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { k as listMealPlans } from '../catalog-client.mjs';
import { e as extractAuthContext, l as logger } from '../logger.mjs';
import '@mastra/core/request-context';
import 'node:async_hooks';
import 'pino';

const listMealPlansToolInput = z.object({
  page: z.number().int().min(1).default(1).describe("N\xFAmero da p\xE1gina"),
  page_size: z.number().int().min(1).max(50).default(10).describe("Itens por p\xE1gina")
});
const listMealPlansToolOutput = z.object({
  plans: z.array(
    z.object({
      id: z.string(),
      plan_name: z.string(),
      daily_calories: z.number(),
      created_by: z.string(),
      created_at: z.string()
    })
  ),
  total: z.number().describe("Total de planos"),
  message: z.string().describe("Mensagem descritiva")
});
const listMealPlansTool = createTool({
  id: "list_meal_plans",
  description: "Lista todos os planos alimentares (dietas) do usu\xE1rio. Use quando o usu\xE1rio pedir para ver suas dietas, listar planos, ou consultar planos existentes. Exemplos: 'Quais s\xE3o minhas dietas?', 'Mostre meus planos', 'Tenho alguma dieta cadastrada?'",
  inputSchema: listMealPlansToolInput,
  outputSchema: listMealPlansToolOutput,
  execute: async (inputData, executionContext) => {
    const { page = 1, page_size = 10 } = inputData;
    const { userId, authToken } = extractAuthContext(executionContext);
    if (userId === "anonymous") {
      throw new Error(
        "Usu\xE1rio n\xE3o autenticado. Por favor, fa\xE7a login para ver seus planos."
      );
    }
    logger.info(
      `\u{1F4CB} [Tool:listMealPlans] Listando planos para usu\xE1rio: ${userId}`
    );
    try {
      const result = await listMealPlans(
        userId,
        page,
        page_size,
        void 0,
        authToken
      );
      const plans = result.plans.map((p) => ({
        id: p.id,
        plan_name: p.plan_name,
        daily_calories: p.daily_calories,
        created_by: p.created_by,
        created_at: p.created_at
      }));
      logger.info(`\u2705 [Tool:listMealPlans] Encontrados ${result.total} planos`);
      return {
        plans,
        total: result.total,
        message: result.total === 0 ? "Voc\xEA ainda n\xE3o tem planos alimentares cadastrados." : `Encontrei ${result.total} plano(s) alimentar(es).`
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      logger.error(`\u274C [Tool:listMealPlans] Erro: ${errorMessage}`);
      throw new Error(`Erro ao listar planos: ${errorMessage}`);
    }
  }
});

export { listMealPlansTool };
