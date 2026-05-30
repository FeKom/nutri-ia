import { withAuth } from "../../../utils/with-auth";
import { z } from "zod";
import { createMealPlanWorkflow } from "../../../workflows/create-meal-plan";
import { logger } from "../../../../utils/logger";

const createMealPlanToolInput = z.object({
  plan_name: z.string().min(1).max(100).describe("Nome do plano alimentar"),
  description: z
    .string()
    .max(500)
    .optional()
    .describe("Descrição do plano alimentar"),
});

const createMealPlanToolOutput = z.object({
  id: z.string().describe("ID do plano criado"),
  plan_name: z.string().describe("Nome do plano"),
  daily_calories: z.number().describe("Calorias diárias"),
  message: z.string().describe("Mensagem de sucesso"),
});

export const createMealPlanTool = withAuth({
  id: "create_meal_plan",
  description:
    "Cria um novo plano alimentar personalizado para o usuário com base no perfil dele. " +
    "Use quando o usuário pedir para criar uma dieta, plano alimentar, ou definir metas nutricionais. " +
    "Exemplos: 'Crie uma dieta para perder peso', 'Monta um plano de 2000 calorias', 'Quero um plano low carb'",
  inputSchema: createMealPlanToolInput,
  outputSchema: createMealPlanToolOutput,
  execute: async (inputData, { userId, authToken, userProfile }) => {
    const { plan_name, description } = inputData;

    if (!userId) {
      throw new Error(
        "Usuário não autenticado. Por favor, faça login para criar planos alimentares.",
      );
    }

    logger.info(`[Tool:createMealPlan] Triggering workflow for user ${userId}, plan "${plan_name}"`);

    const run = await createMealPlanWorkflow.createRun();
    const result = await run.start({
      inputData: {
        plan_name,
        description,
        userId,
        authToken: authToken ?? "",
        weight_kg: Number(userProfile?.weight),
        height_cm: Number(userProfile?.height),
        age: Number(userProfile?.age),
        gender: (userProfile?.gender ?? "") as "male" | "female" | "non_binary",
        activity_level: (userProfile?.activity_level ?? "") as
          | "sedentary"
          | "light"
          | "moderate"
          | "active"
          | "very_active",
        diet_goal: (userProfile?.goal ?? "") as "weight_loss" | "weight_gain" | "maintain",
      },
    });

    if (result.status !== "success") {
      const err = (result as any).error ?? "Erro desconhecido no workflow";
      logger.error(`[Tool:createMealPlan] Workflow failed: ${err}`);
      throw new Error(`Erro ao criar plano alimentar: ${err}`);
    }

    const output = result.result;

    logger.info(`[Tool:createMealPlan] Workflow completed, plan id: ${output.id}`);

    return {
      id: output.id,
      plan_name: output.plan_name,
      daily_calories: output.daily_calories,
      message: output.message,
    };
  },
});
