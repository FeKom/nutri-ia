import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getMealPlan } from "../clients/catalog-client";
import { extractAuthContext } from "../utils/auth-context";
import { logger } from "../../utils/logger";

const getMealPlanToolInput = z.object({
  plan_id: z.string().describe("ID do plano alimentar"),
});

const getMealPlanToolOutput = z.object({
  id: z.string(),
  plan_name: z.string(),
  description: z.string().optional(),
  daily_calories: z.number(),
  daily_protein_g: z.number(),
  daily_fat_g: z.number(),
  daily_carbs_g: z.number(),
  created_by: z.string(),
  meals: z.array(z.record(z.unknown())),
  created_at: z.string(),
});

export const getMealPlanTool = createTool({
  id: "get_meal_plan",
  description:
    "Busca detalhes de um plano alimentar específico. " +
    "Use quando o usuário pedir detalhes, informações completas, ou quiser ver um plano específico. " +
    "Exemplos: 'Me mostre detalhes da dieta X', 'Qual é o plano de 2000 calorias?', 'Informações do meu plano'",
  inputSchema: getMealPlanToolInput,
  outputSchema: getMealPlanToolOutput,
  execute: async (inputData, executionContext) => {
    const { plan_id } = inputData;

    const { userId, authToken } = extractAuthContext(executionContext);

    if (userId === "anonymous") {
      throw new Error(
        "Usuário não autenticado. Por favor, faça login para ver planos.",
      );
    }

    logger.info(
      `📋 [Tool:getMealPlan] Buscando plano ${plan_id} para usuário: ${userId}`,
    );

    try {
      const plan = await getMealPlan(plan_id, userId, undefined, authToken);

      logger.info(
        `✅ [Tool:getMealPlan] Plano encontrado: "${plan.plan_name}"`,
      );

      return {
        id: plan.id,
        plan_name: plan.plan_name,
        description: plan.description,
        daily_calories: plan.daily_calories,
        daily_protein_g: plan.daily_protein_g,
        daily_fat_g: plan.daily_fat_g,
        daily_carbs_g: plan.daily_carbs_g,
        created_by: plan.created_by,
        meals: plan.meals,
        created_at: plan.created_at,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Erro desconhecido";
      logger.error(`❌ [Tool:getMealPlan] Erro: ${errorMessage}`);

      throw new Error(
        `Erro ao buscar plano: ${errorMessage}. Verifique se o ID está correto e se você tem permissão para acessar este plano.`,
      );
    }
  },
});
