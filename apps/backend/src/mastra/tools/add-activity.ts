import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { extractAuthContext } from "../utils/auth-context";
import { logger } from "../../utils/logger";
import { defaultConfig } from "../clients/catalog-client";

export const addActivityTool = createTool({
  id: "add_activity",
  description:
    "Registra uma atividade física realizada pelo usuário. " +
    "Use quando o usuário disser que fez exercício, treinou, caminhou, correu, etc. " +
    "Exemplos: 'Fiz 30 minutos de caminhada', 'Treinei musculação por 1 hora'. " +
    "Pergunte a duração e o tipo de atividade se não estiverem claros.",
  inputSchema: z.object({
    type: z
      .enum(["caminhada", "corrida", "musculacao", "natacao", "ciclismo", "yoga", "outro"])
      .describe("Tipo de atividade"),
    duration_minutes: z.number().int().positive().describe("Duração em minutos"),
    calories_burned: z.number().int().nonnegative().describe("Calorias queimadas estimadas"),
    date: z.string().describe("Data da atividade no formato YYYY-MM-DD"),
    notes: z.string().optional().describe("Observações (opcional)"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    activity_id: z.string().optional(),
    message: z.string(),
  }),
  execute: async (input, executionContext) => {
    const { userId, authToken } = extractAuthContext(executionContext);
    if (!userId || userId === "anonymous") {
      return { success: false, message: "Usuário não autenticado." };
    }

    logger.info(`🏃 [Tool:addActivity] Registrando ${input.type} para ${userId}`);

    try {
      const res = await fetch(`${defaultConfig.baseURL}/api/v1/activities`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(input),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`API ${res.status}: ${err}`);
      }

      const activity = await res.json();
      logger.info(`✅ [Tool:addActivity] Atividade criada: ${activity.id}`);
      return {
        success: true,
        activity_id: activity.id,
        message: `${input.type} de ${input.duration_minutes} minutos registrada com sucesso!`,
      };
    } catch (error) {
      logger.error(`❌ [Tool:addActivity] ${error}`);
      return { success: false, message: `Erro ao registrar atividade: ${error instanceof Error ? error.message : error}` };
    }
  },
});
