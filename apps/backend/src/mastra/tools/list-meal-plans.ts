import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { listMealPlans } from "../clients/catalog-client";
import { extractAuthContext } from "../utils/auth-context";
import { logger } from "../../utils/logger";

const listMealPlansToolInput = z.object({
  page: z.number().int().min(1).default(1).describe("Número da página"),
  page_size: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe("Itens por página"),
});

const listMealPlansToolOutput = z.object({
  plans: z.array(
    z.object({
      id: z.string(),
      plan_name: z.string(),
      daily_calories: z.number(),
      created_by: z.string(),
      created_at: z.string(),
    }),
  ),
  total: z.number().describe("Total de planos"),
  message: z.string().describe("Mensagem descritiva"),
});

export const listMealPlansTool = createTool({
  id: "list_meal_plans",
  description:
    "Lista todos os planos alimentares (dietas) do usuário. " +
    "Use quando o usuário pedir para ver suas dietas, listar planos, ou consultar planos existentes. " +
    "Exemplos: 'Quais são minhas dietas?', 'Mostre meus planos', 'Tenho alguma dieta cadastrada?'",
  inputSchema: listMealPlansToolInput,
  outputSchema: listMealPlansToolOutput,
  execute: async (inputData, executionContext) => {
    const { page = 1, page_size = 10 } = inputData;

    const { userId, authToken } = extractAuthContext(executionContext);

    if (userId === "anonymous") {
      throw new Error(
        "Usuário não autenticado. Por favor, faça login para ver seus planos.",
      );
    }

    logger.info(
      `📋 [Tool:listMealPlans] Listando planos para usuário: ${userId}`,
    );

    try {
      const result = await listMealPlans(
        userId,
        page,
        page_size,
        undefined,
        authToken,
      );

      const plans = result.plans.map((p) => ({
        id: p.id,
        plan_name: p.plan_name,
        daily_calories: p.daily_calories,
        created_by: p.created_by,
        created_at: p.created_at,
      }));

      logger.info(`✅ [Tool:listMealPlans] Encontrados ${result.total} planos`);

      return {
        plans,
        total: result.total,
        message:
          result.total === 0
            ? "Você ainda não tem planos alimentares cadastrados."
            : `Encontrei ${result.total} plano(s) alimentar(es).`,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Erro desconhecido";
      logger.error(`❌ [Tool:listMealPlans] Erro: ${errorMessage}`);

      throw new Error(`Erro ao listar planos: ${errorMessage}`);
    }
  },
});
