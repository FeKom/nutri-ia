/**
 * Tool para atualizar perfil de usuário
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import {
  invalidateUserProfileCache,
} from "../utils/user-profile-loader";
import { extractAuthContext } from "../utils/auth-context";
import { updateUserProfile, defaultConfig } from "../clients/catalog-client";
import { logger } from "../../utils/logger";

const updateUserProfileToolInput = z.object({
  weight_kg: z.number().positive().optional().describe("Novo peso em kg"),
  height_cm: z.number().positive().optional().describe("Nova altura em cm"),
  age: z.number().int().min(1).max(120).optional().describe("Nova idade"),
  gender: z
    .enum(["male", "female", "non_binary"])
    .optional()
    .describe("Gênero (male, female ou non_binary)"),
  activity_level: z
    .enum(["sedentary", "light", "moderate", "active", "very_active"])
    .optional()
    .describe("Nível de atividade física"),
  diet_goal: z
    .enum(["weight_loss", "weight_gain", "maintain"])
    .optional()
    .describe("Objetivo alimentar"),
  dietary_restrictions: z
    .array(z.string())
    .optional()
    .describe("Restrições alimentares"),
  allergies: z.array(z.string()).optional().describe("Alergias alimentares"),
  disliked_foods: z
    .array(z.string())
    .optional()
    .describe("Alimentos que não gosta"),
});

export const updateUserProfileTool = createTool({
  id: "update_user_profile",
  description:
    "Atualiza o perfil do usuário com novos dados. Use quando o usuário quiser alterar informações como peso, altura, objetivo ou restrições. " +
    "Apenas os campos fornecidos serão atualizados — os demais permanecem inalterados.",
  inputSchema: updateUserProfileToolInput,
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    profile: z
      .object({
        weight_kg: z.number().optional(),
        height_cm: z.number().optional(),
        age: z.number().optional(),
        gender: z.string().optional(),
        activity_level: z.string().optional(),
        diet_goal: z.string().optional(),
      })
      .optional(),
  }),
  execute: async (inputData, executionContext) => {
    const { userId, authToken } = extractAuthContext(executionContext);

    if (!userId || userId === "anonymous") {
      return {
        success: false,
        message: "Usuário não autenticado. Faça login primeiro.",
      };
    }

    logger.info(
      `✏️ [Tool:updateUserProfile] Atualizando perfil para usuário: ${userId}`,
    );

    try {
      const profileData = await updateUserProfile(
        inputData,
        defaultConfig,
        authToken,
      );

      invalidateUserProfileCache(userId);
      logger.info("✅ [Tool:updateUserProfile] Perfil atualizado com sucesso!");

      return {
        success: true,
        message: "Perfil atualizado com sucesso!",
        profile: {
          weight_kg: profileData.weight_kg ?? undefined,
          height_cm: profileData.height_cm ?? undefined,
          age: profileData.age,
          gender: profileData.gender,
          activity_level: profileData.activity_level,
          diet_goal: profileData.diet_goal,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Erro desconhecido";
      logger.error(`❌ [Tool:updateUserProfile] Erro: ${error instanceof Error ? error.message : error}`);

      return {
        success: false,
        message: `Erro ao atualizar perfil: ${errorMessage}`,
      };
    }
  },
});
