import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { extractAuthContext } from "../utils/auth-context";
import { logger } from "../../utils/logger";
import { defaultConfig } from "../clients/catalog-client";

export const addGoalTool = createTool({
  id: "add_goal",
  description:
    "Salva uma meta pessoal do usuário no banco de dados. " +
    "Use quando o usuário mencionar um objetivo específico como 'quero chegar a 70kg', " +
    "'preciso comer 120g de proteína por dia', ou 'quero treinar 4x por semana'. " +
    "Sempre confirme os valores antes de salvar.",
  inputSchema: z.object({
    title: z.string().describe("Título da meta (ex: 'Chegar a 70kg')"),
    description: z.string().optional().describe("Descrição opcional"),
    target_value: z.number().describe("Valor alvo (ex: 70)"),
    current_value: z.number().describe("Valor atual (ex: 75)"),
    unit: z.string().describe("Unidade (ex: kg, g, treinos, kcal)"),
    category: z.enum(["peso", "nutricao", "atividade"]).describe("Categoria da meta"),
    deadline: z.string().optional().describe("Data limite no formato YYYY-MM-DD (opcional)"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    goal_id: z.string().optional(),
    message: z.string(),
  }),
  execute: async (input, executionContext) => {
    const { userId, authToken } = extractAuthContext(executionContext);
    if (!userId || userId === "anonymous") {
      return { success: false, message: "Usuário não autenticado." };
    }

    logger.info(`🎯 [Tool:addGoal] Salvando meta para ${userId}: ${input.title}`);

    try {
      const res = await fetch(`${defaultConfig.baseURL}/api/v1/goals`, {
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

      const goal = await res.json();
      logger.info(`✅ [Tool:addGoal] Meta criada: ${goal.id}`);
      return { success: true, goal_id: goal.id, message: `Meta "${input.title}" salva com sucesso!` };
    } catch (error) {
      logger.error(`❌ [Tool:addGoal] ${error}`);
      return { success: false, message: `Erro ao salvar meta: ${error instanceof Error ? error.message : error}` };
    }
  },
});
