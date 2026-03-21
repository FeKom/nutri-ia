import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { g as getUserProfileFromDB } from '../user-profile-loader.mjs';
import { e as extractAuthContext, l as logger } from '../logger.mjs';
import '@mastra/core/request-context';
import 'node:async_hooks';
import 'pino';

const calculateMacrosToolInput = z.object({
  override_weight_kg: z.number().positive().optional().describe("Peso em kg (opcional, usa do perfil se n\xE3o fornecido)"),
  override_height_cm: z.number().positive().optional().describe("Altura em cm (opcional, usa do perfil se n\xE3o fornecido)"),
  override_age: z.number().int().positive().optional().describe("Idade (opcional, usa do perfil se n\xE3o fornecido)"),
  override_gender: z.enum(["male", "female", "non_binary"]).optional().describe("G\xEAnero (opcional, usa do perfil se n\xE3o fornecido)"),
  override_activity_level: z.enum(["sedentary", "light", "moderate", "active", "very_active"]).optional().describe("N\xEDvel de atividade (opcional, usa do perfil se n\xE3o fornecido)"),
  override_diet_goal: z.enum(["weight_loss", "weight_gain", "maintain"]).optional().describe("Objetivo (opcional, usa do perfil se n\xE3o fornecido)")
});
const calculateMacrosToolOutput = z.object({
  success: z.boolean().describe("Se o c\xE1lculo foi bem-sucedido"),
  tmb: z.number().describe("Taxa Metab\xF3lica Basal (kcal/dia)"),
  tdee: z.number().describe("Gasto Energ\xE9tico Di\xE1rio Total (kcal/dia)"),
  daily_calories: z.number().describe("Calorias di\xE1rias recomendadas"),
  daily_protein_g: z.number().describe("Prote\xEDna di\xE1ria em gramas"),
  daily_carbs_g: z.number().describe("Carboidratos di\xE1rios em gramas"),
  daily_fat_g: z.number().describe("Gordura di\xE1ria em gramas"),
  calorie_adjustment: z.number().describe("Ajuste cal\xF3rico aplicado (d\xE9ficit/super\xE1vit)"),
  diet_goal: z.string().describe("Objetivo do plano"),
  profile_used: z.object({
    weight_kg: z.number(),
    height_cm: z.number(),
    age: z.number(),
    gender: z.string(),
    activity_level: z.string(),
    diet_goal: z.string()
  }).describe("Perfil usado para o c\xE1lculo"),
  explanation: z.string().describe("Explica\xE7\xE3o do c\xE1lculo em portugu\xEAs")
});
function calculateTMB(weight_kg, height_cm, age, gender) {
  const base = 10 * weight_kg + 6.25 * height_cm - 5 * age;
  const genderAdjustment = gender === "male" ? 5 : gender === "non_binary" ? -78 : -161;
  return Math.round(base + genderAdjustment);
}
function getActivityFactor(activity_level) {
  const factors = {
    sedentary: 1.2,
    // Pouco ou nenhum exercício
    light: 1.375,
    // Exercício leve 1-3 dias/semana
    moderate: 1.55,
    // Exercício moderado 3-5 dias/semana
    active: 1.725,
    // Exercício intenso 6-7 dias/semana
    very_active: 1.9
    // Exercício muito intenso, trabalho físico
  };
  return factors[activity_level] || 1.2;
}
function getCalorieAdjustment(diet_goal) {
  const adjustments = {
    weight_loss: -500,
    // Déficit de 500 kcal/dia = ~0.5kg/semana
    weight_gain: 500,
    // Superávit de 500 kcal/dia = ~0.5kg/semana
    maintain: 0
    // Manutenção
  };
  return adjustments[diet_goal] || 0;
}
function calculateMacros(daily_calories, weight_kg, diet_goal) {
  let protein_g_per_kg = 1.6;
  if (diet_goal === "weight_loss") {
    protein_g_per_kg = 2;
  } else if (diet_goal === "weight_gain") {
    protein_g_per_kg = 2.2;
  }
  const protein_g = Math.round(weight_kg * protein_g_per_kg);
  const protein_calories = protein_g * 4;
  const fat_percentage = 0.28;
  const fat_calories = daily_calories * fat_percentage;
  const fat_g = Math.round(fat_calories / 9);
  const carbs_calories = daily_calories - protein_calories - fat_calories;
  const carbs_g = Math.round(carbs_calories / 4);
  return { protein_g, carbs_g, fat_g };
}
const calculateMacrosTool = createTool({
  id: "calculate_macros",
  description: "Utilize est\xE1 tool quando o usu\xE1rio perguntar quantas calorias ele ter\xE1 que consumirN\xE3o utilize essa tool para calcular os alimentos, para calcular alimentos utilize calculate-nutritionCalcula metas nutricionais (calorias e macros) baseado no perfil do usu\xE1rio. Usa f\xF3rmula de Mifflin-St Jeor para TMB e distribui macros otimizados por objetivo. Use quando precisar calcular quantidades para um plano alimentar ou quando o usu\xE1rio perguntar quantas calorias/prote\xEDnas deve consumir. Pode sobrescrever valores do perfil se necess\xE1rio.",
  inputSchema: calculateMacrosToolInput,
  outputSchema: calculateMacrosToolOutput,
  execute: async (inputData, executionContext) => {
    const {
      override_weight_kg,
      override_height_cm,
      override_age,
      override_gender,
      override_activity_level,
      override_diet_goal
    } = inputData;
    const { userId } = extractAuthContext(executionContext);
    logger.info(
      `\u{1F9EE} [Tool:calculateMacros] Calculando macros para usu\xE1rio: ${userId}`
    );
    try {
      let profile = null;
      let weight_kg = override_weight_kg;
      let height_cm = override_height_cm;
      let age = override_age;
      let gender = override_gender;
      let activity_level = override_activity_level;
      let diet_goal = override_diet_goal;
      if (!weight_kg || !height_cm || !age || !gender || !activity_level || !diet_goal) {
        if (userId === "anonymous") {
          throw new Error(
            "Dados insuficientes para calcular macros. Forne\xE7a peso, altura, idade, g\xEAnero, n\xEDvel de atividade e objetivo, ou crie um perfil."
          );
        }
        profile = await getUserProfileFromDB(userId);
        if (!profile) {
          throw new Error(
            "Perfil n\xE3o encontrado. Crie um perfil primeiro ou forne\xE7a todos os dados necess\xE1rios."
          );
        }
        weight_kg = weight_kg || profile.weight;
        height_cm = height_cm || profile.height;
        age = age || profile.age;
        gender = gender || profile.gender?.toLowerCase();
        activity_level = activity_level || profile.activity_level;
        diet_goal = diet_goal || profile.goal;
      }
      if (!weight_kg || !height_cm || !age || !gender || !activity_level || !diet_goal) {
        const missingFields = [];
        if (!weight_kg) missingFields.push("peso (override_weight_kg)");
        if (!height_cm) missingFields.push("altura (override_height_cm)");
        if (!age) missingFields.push("idade (override_age)");
        if (!gender) missingFields.push("g\xEAnero (override_gender)");
        if (!activity_level) missingFields.push("n\xEDvel de atividade (override_activity_level)");
        if (!diet_goal) missingFields.push("objetivo (override_diet_goal)");
        throw new Error(
          `Dados incompletos para calcular macros. Campos faltando: ${missingFields.join(", ")}. Pe\xE7a ao usu\xE1rio esses dados e chame a tool novamente usando os par\xE2metros override_* correspondentes.`
        );
      }
      if (!["male", "female", "non_binary"].includes(gender)) {
        if (gender.includes("masc") || gender.includes("homem")) {
          gender = "male";
        } else if (gender.includes("fem") || gender.includes("mulher")) {
          gender = "female";
        } else if (gender.includes("nb") || gender.includes("n\xE3o bin\xE1r") || gender.includes("nao binar") || gender.includes("non")) {
          gender = "non_binary";
        } else {
          throw new Error(
            `G\xEAnero inv\xE1lido: ${gender}. Use 'male', 'female' ou 'non_binary'.`
          );
        }
      }
      logger.info(
        `   Perfil: ${weight_kg}kg, ${height_cm}cm, ${age} anos, ${gender}`
      );
      logger.info(`   Atividade: ${activity_level}, Objetivo: ${diet_goal}`);
      const tmb = calculateTMB(weight_kg, height_cm, age, gender);
      logger.info(`   TMB: ${tmb} kcal/dia`);
      const activityFactor = getActivityFactor(activity_level);
      const tdee = Math.round(tmb * activityFactor);
      logger.info(`   TDEE: ${tdee} kcal/dia (fator ${activityFactor})`);
      const calorieAdjustment = getCalorieAdjustment(diet_goal);
      const daily_calories = tdee + calorieAdjustment;
      logger.info(
        `   Calorias ajustadas: ${daily_calories} kcal/dia (${calorieAdjustment >= 0 ? "+" : ""}${calorieAdjustment})`
      );
      const macros = calculateMacros(daily_calories, weight_kg, diet_goal);
      logger.info(
        `   Macros: ${macros.protein_g}g prote\xEDna, ${macros.carbs_g}g carbos, ${macros.fat_g}g gordura`
      );
      const goalNames = {
        weight_loss: "perda de peso",
        weight_gain: "ganho de peso",
        maintain: "manuten\xE7\xE3o"
      };
      const activityNames = {
        sedentary: "sedent\xE1rio",
        light: "levemente ativo",
        moderate: "moderadamente ativo",
        active: "muito ativo",
        very_active: "extremamente ativo"
      };
      const explanation = `
Baseado no seu perfil (${weight_kg}kg, ${height_cm}cm, ${age} anos, ${gender === "male" ? "masculino" : gender === "non_binary" ? "n\xE3o bin\xE1rio" : "feminino"}):

\u{1F4CA} **C\xE1lculos Nutricionais**
\u2022 TMB (metabolismo basal): ${tmb} kcal/dia
\u2022 TDEE (gasto total com atividade ${activityNames[activity_level]}): ${tdee} kcal/dia
\u2022 Meta ajustada para ${goalNames[diet_goal]}: ${daily_calories} kcal/dia

\u{1F37D}\uFE0F **Distribui\xE7\xE3o de Macros**
\u2022 Prote\xEDna: ${macros.protein_g}g/dia (${(macros.protein_g / weight_kg).toFixed(1)}g/kg)
\u2022 Carboidratos: ${macros.carbs_g}g/dia
\u2022 Gordura: ${macros.fat_g}g/dia

\u{1F4A1} **Nota**: Estes valores s\xE3o estimativas. Ajuste conforme necess\xE1rio baseado nos resultados.
`.trim();
      logger.info(`\u2705 [Tool:calculateMacros] C\xE1lculo conclu\xEDdo com sucesso`);
      return {
        success: true,
        tmb,
        tdee,
        daily_calories,
        daily_protein_g: macros.protein_g,
        daily_carbs_g: macros.carbs_g,
        daily_fat_g: macros.fat_g,
        calorie_adjustment: calorieAdjustment,
        diet_goal,
        profile_used: {
          weight_kg,
          height_cm,
          age,
          gender,
          activity_level,
          diet_goal
        },
        explanation
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      logger.error(`\u274C [Tool:calculateMacros] Erro: ${errorMessage}`);
      throw new Error(`Erro ao calcular macros: ${errorMessage}`);
    }
  }
});

export { calculateMacrosTool };
