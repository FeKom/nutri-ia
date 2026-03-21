import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { i as invalidateUserProfileCache } from '../user-profile-loader.mjs';
import { e as extractAuthContext, l as logger } from '../logger.mjs';
import { n as updateUserProfile, e as defaultConfig } from '../catalog-client.mjs';
import '@mastra/core/request-context';
import 'node:async_hooks';
import 'pino';

const updateUserProfileToolInput = z.object({
  weight_kg: z.number().positive().optional().describe("Novo peso em kg"),
  height_cm: z.number().positive().optional().describe("Nova altura em cm"),
  age: z.number().int().min(1).max(120).optional().describe("Nova idade"),
  gender: z.enum(["male", "female", "non_binary"]).optional().describe("G\xEAnero (male, female ou non_binary)"),
  activity_level: z.enum(["sedentary", "light", "moderate", "active", "very_active"]).optional().describe("N\xEDvel de atividade f\xEDsica"),
  diet_goal: z.enum(["weight_loss", "weight_gain", "maintain"]).optional().describe("Objetivo alimentar"),
  dietary_restrictions: z.array(z.string()).optional().describe("Restri\xE7\xF5es alimentares"),
  allergies: z.array(z.string()).optional().describe("Alergias alimentares"),
  disliked_foods: z.array(z.string()).optional().describe("Alimentos que n\xE3o gosta")
});
const updateUserProfileTool = createTool({
  id: "update_user_profile",
  description: "Atualiza o perfil do usu\xE1rio com novos dados. Use quando o usu\xE1rio quiser alterar informa\xE7\xF5es como peso, altura, objetivo ou restri\xE7\xF5es. Apenas os campos fornecidos ser\xE3o atualizados \u2014 os demais permanecem inalterados.",
  inputSchema: updateUserProfileToolInput,
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    profile: z.object({
      weight_kg: z.number().optional(),
      height_cm: z.number().optional(),
      age: z.number().optional(),
      gender: z.string().optional(),
      activity_level: z.string().optional(),
      diet_goal: z.string().optional()
    }).optional()
  }),
  execute: async (inputData, executionContext) => {
    const { userId, authToken } = extractAuthContext(executionContext);
    if (!userId || userId === "anonymous") {
      return {
        success: false,
        message: "Usu\xE1rio n\xE3o autenticado. Fa\xE7a login primeiro."
      };
    }
    logger.info(
      `\u270F\uFE0F [Tool:updateUserProfile] Atualizando perfil para usu\xE1rio: ${userId}`
    );
    try {
      const profileData = await updateUserProfile(
        inputData,
        defaultConfig,
        authToken
      );
      invalidateUserProfileCache(userId);
      logger.info("\u2705 [Tool:updateUserProfile] Perfil atualizado com sucesso!");
      return {
        success: true,
        message: "Perfil atualizado com sucesso!",
        profile: {
          weight_kg: profileData.weight_kg ?? void 0,
          height_cm: profileData.height_cm ?? void 0,
          age: profileData.age,
          gender: profileData.gender,
          activity_level: profileData.activity_level,
          diet_goal: profileData.diet_goal
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      logger.error(`\u274C [Tool:updateUserProfile] Erro: ${error instanceof Error ? error.message : error}`);
      return {
        success: false,
        message: `Erro ao atualizar perfil: ${errorMessage}`
      };
    }
  }
});

export { updateUserProfileTool };
