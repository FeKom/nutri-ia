import { withAuth } from "../../../utils/with-auth";
import { z } from "zod";
import { calculateMacros, unwrap } from "../../../clients/catalog-client";
import { logger } from "../../../../utils/logger";

const calculateMacrosToolInput = z.object({
  override_weight_kg: z.number().positive().optional().describe("Peso em kg (opcional, usa do perfil se não fornecido)"),
  override_height_cm: z.number().positive().optional().describe("Altura em cm (opcional, usa do perfil se não fornecido)"),
  override_age: z.number().int().positive().optional().describe("Idade (opcional, usa do perfil se não fornecido)"),
  override_gender: z.enum(["male", "female", "non_binary"]).optional().describe("Gênero (opcional, usa do perfil se não fornecido)"),
  override_activity_level: z.enum(["sedentary", "light", "moderate", "active", "very_active"]).optional().describe("Nível de atividade (opcional, usa do perfil se não fornecido)"),
  override_diet_goal: z.enum(["weight_loss", "weight_gain", "maintain"]).optional().describe("Objetivo (opcional, usa do perfil se não fornecido)"),
});

const calculateMacrosToolOutput = z.object({
  success: z.boolean(),
  tmb: z.number().describe("Taxa Metabólica Basal (kcal/dia)"),
  tdee: z.number().describe("Gasto Energético Diário Total (kcal/dia)"),
  daily_calories: z.number().describe("Calorias diárias recomendadas"),
  daily_protein_g: z.number().describe("Proteína diária em gramas"),
  daily_carbs_g: z.number().describe("Carboidratos diários em gramas"),
  daily_fat_g: z.number().describe("Gordura diária em gramas"),
  calorie_adjustment: z.number().describe("Ajuste calórico aplicado (déficit/superávit)"),
  diet_goal: z.string().describe("Objetivo do plano"),
  profile_used: z.object({
    weight_kg: z.number(),
    height_cm: z.number(),
    age: z.number(),
    gender: z.string(),
    activity_level: z.string(),
    diet_goal: z.string(),
  }),
  explanation: z.string().describe("Explicação do cálculo em português"),
});

export const calculateMacrosTool = withAuth({
  id: "calculate_macros",
  description:
    "Utilize está tool quando o usuário perguntar quantas calorias ele terá que consumir. " +
    "Não utilize essa tool para calcular os alimentos, para calcular alimentos utilize calculate-nutrition. " +
    "Calcula metas nutricionais (calorias e macros) baseado no perfil do usuário. " +
    "Use quando precisar calcular quantidades para um plano alimentar ou quando o usuário " +
    "perguntar quantas calorias/proteínas deve consumir. Pode sobrescrever valores do perfil se necessário.",
  inputSchema: calculateMacrosToolInput,
  outputSchema: calculateMacrosToolOutput,
  execute: async (inputData, { userId, authToken, userProfile }) => {
    const weight_kg = inputData.override_weight_kg ?? (userProfile?.weight != null ? Number(userProfile.weight) : undefined);
    const height_cm = inputData.override_height_cm ?? (userProfile?.height != null ? Number(userProfile.height) : undefined);
    const age = inputData.override_age ?? (userProfile?.age != null ? Number(userProfile.age) : undefined);
    const gender = inputData.override_gender ?? (userProfile?.gender as "male" | "female" | "non_binary" | undefined);
    const activity_level = inputData.override_activity_level ?? userProfile?.activity_level;
    const diet_goal = inputData.override_diet_goal ?? userProfile?.goal;

    const missingFields: string[] = [];
    if (!weight_kg) missingFields.push("peso (override_weight_kg)");
    if (!height_cm) missingFields.push("altura (override_height_cm)");
    if (!age) missingFields.push("idade (override_age)");
    if (!gender) missingFields.push("gênero (override_gender)");
    if (!activity_level) missingFields.push("nível de atividade (override_activity_level)");
    if (!diet_goal) missingFields.push("objetivo (override_diet_goal)");

    if (missingFields.length > 0) {
      throw new Error(
        `Dados incompletos para calcular macros. Campos faltando: ${missingFields.join(", ")}. ` +
        `Peça ao usuário esses dados e chame a tool novamente usando os parâmetros override_* correspondentes.`,
      );
    }

    logger.info(`🧮 [Tool:calculateMacros] Calculando macros para usuário: ${userId}`);

    const data = unwrap(await calculateMacros(
      { weight_kg: weight_kg!, height_cm: height_cm!, age: age!, gender: gender!, activity_level: activity_level!, diet_goal: diet_goal! },
      undefined,
      authToken,
    ));
    logger.info(`✅ [Tool:calculateMacros] Cálculo concluído: ${data.daily_calories} kcal/dia`);

    return { success: true, ...data };
  },
});
