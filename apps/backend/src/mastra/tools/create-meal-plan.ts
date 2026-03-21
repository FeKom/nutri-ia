import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createMealPlan } from "../clients/catalog-client";
import { extractAuthContext } from "../utils/auth-context";
import { logger } from "../../utils/logger";
const createMealPlanToolInput = z.object({
  plan_name: z.string().min(1).max(100).describe("Nome do plano alimentar"),
  description: z
    .string()
    .max(500)
    .optional()
    .describe("Descrição do plano alimentar"),
  daily_calories: z.number().positive().describe("Meta diária de calorias"),
  daily_protein_g: z
    .number()
    .positive()
    .describe("Meta diária de proteína em gramas"),
  daily_fat_g: z
    .number()
    .positive()
    .describe("Meta diária de gordura em gramas"),
  daily_carbs_g: z
    .number()
    .positive()
    .describe("Meta diária de carboidratos em gramas"),
  meals: z
    .array(z.record(z.unknown()))
    .optional()
    .describe("Lista de refeições do plano (opcional)"),
});

const createMealPlanToolOutput = z.object({
  id: z.string().describe("ID do plano criado"),
  plan_name: z.string().describe("Nome do plano"),
  daily_calories: z.number().describe("Calorias diárias"),
  created_by: z.string().describe("Criado por (user ou ai)"),
  message: z.string().describe("Mensagem de sucesso"),
});

export const createMealPlanTool = createTool({
  id: "create_meal_plan",
  description:
    "Cria um novo plano alimentar (dieta) personalizado para o usuário. " +
    "Use quando o usuário pedir para criar uma dieta, plano alimentar, ou definir metas nutricionais. " +
    "Exemplos: 'Crie uma dieta para perder peso', 'Monta um plano de 2000 calorias', 'Quero um plano low carb'",
  inputSchema: createMealPlanToolInput,
  outputSchema: createMealPlanToolOutput,
  execute: async (inputData, executionContext) => {
    const {
      plan_name,
      description,
      daily_calories,
      daily_protein_g,
      daily_fat_g,
      daily_carbs_g,
      meals = [],
    } = inputData;

    // Resolve user ID and JWT from execution context
    const { userId, authToken } = extractAuthContext(executionContext);
    if (!userId) {
      throw new Error(
        "Usuário não autenticado. Por favor, faça login para criar planos alimentares.",
      );
    }

    logger.info(
      `📋 [Tool:createMealPlan] Criando plano para usuário: ${userId}`,
    );

    try {
      const result = await createMealPlan(
        {
          user_id: userId,
          plan_name,
          description,
          daily_calories,
          daily_protein_g,
          daily_fat_g,
          daily_carbs_g,
          created_by: "ai",
          meals,
        },
        undefined,
        authToken,
      );

      logger.info(`✅ [Tool:createMealPlan] Plano criado: ${result.id}`);

      return {
        id: result.id,
        plan_name: result.plan_name,
        daily_calories: result.daily_calories,
        created_by: result.created_by,
        message: `Plano alimentar "${plan_name}" criado com sucesso! Meta diária: ${daily_calories} kcal, ${daily_protein_g}g de proteína, ${daily_carbs_g}g de carboidratos e ${daily_fat_g}g de gordura.`,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Erro desconhecido";
      logger.error(`❌ [Tool:createMealPlan] Erro: ${errorMessage}`);

      throw new Error(`Erro ao criar plano alimentar: ${errorMessage}`);
    }
  },
});
