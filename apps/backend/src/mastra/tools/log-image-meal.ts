import { withAuth } from "../utils/with-auth";
import { z } from "zod";
import { logImageMealWorkflow } from "../workflows/log-image-meal";
import { logger } from "../../utils/logger";

const logImageMealToolInput = z.object({
  image_base64: z
    .string()
    .min(100)
    .describe("Imagem em base64 (com ou sem prefixo data:image)"),
  meal_type: z
    .enum(["breakfast", "lunch", "dinner", "snack"])
    .describe("Tipo de refeição"),
  notes: z.string().optional().describe("Notas sobre a refeição (opcional)"),
});

const logImageMealToolOutput = z.object({
  meal_log_id: z.string(),
  meal_type: z.string(),
  total_calories: z.number(),
  total_protein_g: z.number(),
  total_carbs_g: z.number(),
  total_fat_g: z.number(),
  foods_logged: z.number(),
  message: z.string(),
});

export const logImageMealTool = withAuth({
  id: "log_image_meal",
  description:
    "Analisa uma imagem de refeição com DETIC e registra os alimentos detectados em uma única operação. " +
    "Use quando o usuário enviar uma foto de comida e quiser registrar diretamente, sem etapa de confirmação. " +
    "Exemplos: 'registra esse prato', 'salva essa refeição', 'loga o que tem nessa foto'. " +
    "Para análise sem registro imediato (mostrar o que foi detectado primeiro), use analyze_food_image_detic.",
  inputSchema: logImageMealToolInput,
  outputSchema: logImageMealToolOutput,
  execute: async (inputData, { userId, authToken }) => {
    const { image_base64, meal_type, notes } = inputData;

    if (userId === "anonymous") {
      throw new Error(
        "Usuário não autenticado. Por favor, faça login para registrar refeições.",
      );
    }

    logger.info(
      `[Tool:logImageMeal] Triggering workflow for user ${userId} (meal_type: ${meal_type})`,
    );

    const run = await logImageMealWorkflow.createRun();
    const result = await run.start({
      inputData: {
        image_base64,
        meal_type,
        notes,
        top_k_per_food: 3,
        confidence_threshold: 0.5,
        userId,
        authToken: authToken ?? "",
      },
    });

    if (result.status !== "success") {
      const err = (result as any).error ?? "Erro desconhecido no workflow";
      logger.error(`[Tool:logImageMeal] Workflow failed: ${err}`);
      throw new Error(`Erro ao registrar refeição via imagem: ${err}`);
    }

    const output = result.result;

    logger.info(
      `[Tool:logImageMeal] Workflow completed — meal ${output.meal_log_id}, ${output.foods_logged} food(s), ${output.total_calories} kcal`,
    );

    return {
      meal_log_id: output.meal_log_id,
      meal_type: output.meal_type,
      total_calories: output.total_calories,
      total_protein_g: output.total_protein_g,
      total_carbs_g: output.total_carbs_g,
      total_fat_g: output.total_fat_g,
      foods_logged: output.foods_logged,
      message: output.message,
    };
  },
});
