import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { g as getUserProfileFromDB, i as invalidateUserProfileCache } from '../user-profile-loader.mjs';
import { e as extractAuthContext, l as logger } from '../logger.mjs';
import { d as createUserProfile, e as defaultConfig } from '../catalog-client.mjs';
import '@mastra/core/request-context';
import 'node:async_hooks';
import 'pino';

const createUserProfileToolInput = z.object({
  name: z.string().describe("Nome do usu\xE1rio"),
  age: z.number().int().min(1).max(120).describe("Idade do usu\xE1rio"),
  weight_kg: z.number().positive().describe("Peso em kg"),
  height_cm: z.number().positive().describe("Altura em cm"),
  gender: z.enum(["male", "female", "non_binary"]).describe(
    "G\xEAnero (male, female ou non_binary) - usado para c\xE1lculos nutricionais"
  ),
  activity_level: z.enum(["sedentary", "light", "moderate", "active", "very_active"]).optional().describe("N\xEDvel de atividade f\xEDsica"),
  diet_goal: z.enum(["weight_loss", "weight_gain", "maintain"]).optional().describe("Objetivo alimentar"),
  dietary_restrictions: z.array(z.string()).optional().describe(
    'Restri\xE7\xF5es alimentares (ex: ["vegetarian", "vegan", "gluten-free"])'
  ),
  allergies: z.array(z.string()).optional().describe('Alergias alimentares (ex: ["peanuts", "shellfish", "lactose"])'),
  disliked_foods: z.array(z.string()).optional().describe('Alimentos que n\xE3o gosta (ex: ["broccoli", "liver"])'),
  preferred_cuisines: z.array(z.string()).optional().describe(
    'Culin\xE1rias preferidas (ex: ["brazilian", "italian", "japanese"])'
  )
});
const createUserProfileTool = createTool({
  id: "create_user_profile",
  description: "Cria um novo perfil nutricional para o usu\xE1rio com suas informa\xE7\xF5es pessoais, prefer\xEAncias e restri\xE7\xF5es. Use esta tool ap\xF3s coletar as informa\xE7\xF5es do usu\xE1rio atrav\xE9s de perguntas. O perfil ser\xE1 usado para personalizar recomenda\xE7\xF5es de alimentos e acompanhar o progresso nutricional. Exemplos de quando usar: 'Quero criar meu perfil', 'Preciso configurar minhas restri\xE7\xF5es alimentares', 'Quero personalizar minhas recomenda\xE7\xF5es'",
  inputSchema: createUserProfileToolInput,
  outputSchema: z.object({
    success: z.boolean().describe("Se o perfil foi criado com sucesso"),
    user_id: z.string().optional().describe("ID do usu\xE1rio criado"),
    message: z.string().describe("Mensagem de sucesso ou erro"),
    profile: z.object({
      name: z.string(),
      age: z.number(),
      weight_kg: z.number().optional(),
      height_cm: z.number().optional(),
      gender: z.string().optional(),
      activity_level: z.string().optional(),
      diet_goal: z.string().optional(),
      dietary_restrictions: z.array(z.string()),
      allergies: z.array(z.string()),
      disliked_foods: z.array(z.string())
    }).optional().describe("Dados do perfil criado")
  }),
  execute: async (inputData, executionContext) => {
    const {
      name,
      age,
      weight_kg,
      height_cm,
      gender,
      activity_level,
      diet_goal,
      dietary_restrictions = [],
      allergies = [],
      disliked_foods = [],
      preferred_cuisines = []
    } = inputData;
    const { userId, authToken } = extractAuthContext(executionContext);
    if (!userId || userId === "anonymous") {
      return {
        success: false,
        message: "N\xE3o foi poss\xEDvel criar o perfil: usu\xE1rio n\xE3o autenticado. Por favor, fa\xE7a login primeiro."
      };
    }
    logger.info(`\u{1F464} [Tool:createUserProfile] Criando perfil para usu\xE1rio: ${userId}`);
    const existingProfile = await getUserProfileFromDB(userId);
    if (existingProfile) {
      logger.info(
        `\u26A0\uFE0F [Tool:createUserProfile] Perfil j\xE1 existe para ${userId}`
      );
      return {
        success: true,
        user_id: userId,
        message: "O usu\xE1rio j\xE1 possui um perfil cadastrado. Use os dados existentes ou sugira atualizar o perfil.",
        profile: {
          name: existingProfile.name,
          age: existingProfile.age ?? 0,
          weight_kg: existingProfile.weight ?? void 0,
          height_cm: existingProfile.height ?? void 0,
          gender: existingProfile.gender,
          activity_level: existingProfile.activity_level,
          diet_goal: existingProfile.goal,
          dietary_restrictions: existingProfile.restrictions,
          allergies: existingProfile.allergies,
          disliked_foods: existingProfile.dislikes
        }
      };
    }
    try {
      const profileData = await createUserProfile(
        {
          user_id: userId,
          name,
          age,
          weight_kg,
          height_cm,
          gender,
          activity_level: activity_level || "moderate",
          diet_goal: diet_goal || "maintain",
          dietary_restrictions,
          allergies,
          disliked_foods,
          preferred_cuisines
        },
        defaultConfig,
        authToken
      );
      logger.info("\u2705 [Tool:createUserProfile] Perfil criado com sucesso!");
      invalidateUserProfileCache(userId);
      return {
        success: true,
        user_id: userId,
        message: `Perfil criado com sucesso! Agora posso fornecer recomenda\xE7\xF5es personalizadas baseadas em suas prefer\xEAncias e restri\xE7\xF5es.`,
        profile: {
          name: profileData.name,
          age: profileData.age,
          weight_kg: profileData.weight_kg ?? void 0,
          height_cm: profileData.height_cm ?? void 0,
          gender: profileData.gender,
          activity_level: profileData.activity_level,
          diet_goal: profileData.diet_goal,
          dietary_restrictions: profileData.dietary_restrictions || [],
          allergies: profileData.allergies || [],
          disliked_foods: profileData.disliked_foods || []
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      logger.error(`\u274C [Tool:createUserProfile] Erro: ${error instanceof Error ? error.message : error}`);
      return {
        success: false,
        message: `Erro ao criar perfil: ${errorMessage}`
      };
    }
  }
});

export { createUserProfileTool };
