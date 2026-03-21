/**
 * Tool para calcular metas nutricionais (macros) baseado no perfil do usuário
 *
 * Usa fórmulas validadas cientificamente:
 * - TMB: Mifflin-St Jeor (mais precisa que Harris-Benedict)
 * - TDEE: TMB × Fator de Atividade
 * - Macros: Distribuição otimizada por objetivo
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getUserProfileFromDB } from "../utils/user-profile-loader";
import { extractAuthContext } from "../utils/auth-context";
import { logger } from "../../utils/logger";

const calculateMacrosToolInput = z.object({
  override_weight_kg: z
    .number()
    .positive()
    .optional()
    .describe("Peso em kg (opcional, usa do perfil se não fornecido)"),
  override_height_cm: z
    .number()
    .positive()
    .optional()
    .describe("Altura em cm (opcional, usa do perfil se não fornecido)"),
  override_age: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Idade (opcional, usa do perfil se não fornecido)"),
  override_gender: z
    .enum(["male", "female", "non_binary"])
    .optional()
    .describe("Gênero (opcional, usa do perfil se não fornecido)"),
  override_activity_level: z
    .enum(["sedentary", "light", "moderate", "active", "very_active"])
    .optional()
    .describe("Nível de atividade (opcional, usa do perfil se não fornecido)"),
  override_diet_goal: z
    .enum(["weight_loss", "weight_gain", "maintain"])
    .optional()
    .describe("Objetivo (opcional, usa do perfil se não fornecido)"),
});

const calculateMacrosToolOutput = z.object({
  success: z.boolean().describe("Se o cálculo foi bem-sucedido"),
  tmb: z.number().describe("Taxa Metabólica Basal (kcal/dia)"),
  tdee: z.number().describe("Gasto Energético Diário Total (kcal/dia)"),
  daily_calories: z.number().describe("Calorias diárias recomendadas"),
  daily_protein_g: z.number().describe("Proteína diária em gramas"),
  daily_carbs_g: z.number().describe("Carboidratos diários em gramas"),
  daily_fat_g: z.number().describe("Gordura diária em gramas"),
  calorie_adjustment: z
    .number()
    .describe("Ajuste calórico aplicado (déficit/superávit)"),
  diet_goal: z.string().describe("Objetivo do plano"),
  profile_used: z
    .object({
      weight_kg: z.number(),
      height_cm: z.number(),
      age: z.number(),
      gender: z.string(),
      activity_level: z.string(),
      diet_goal: z.string(),
    })
    .describe("Perfil usado para o cálculo"),
  explanation: z.string().describe("Explicação do cálculo em português"),
});

/**
 * Calcula TMB usando fórmula de Mifflin-St Jeor
 * Mais precisa que Harris-Benedict, especialmente para pessoas com sobrepeso
 */
function calculateTMB(
  weight_kg: number,
  height_cm: number,
  age: number,
  gender: string,
): number {
  // Mifflin-St Jeor
  // Homens: TMB = 10 × peso(kg) + 6.25 × altura(cm) - 5 × idade + 5
  // Mulheres: TMB = 10 × peso(kg) + 6.25 × altura(cm) - 5 × idade - 161

  const base = 10 * weight_kg + 6.25 * height_cm - 5 * age;
  // non_binary usa média dos ajustes male (+5) e female (-161) = -78
  const genderAdjustment =
    gender === "male" ? 5 : gender === "non_binary" ? -78 : -161;

  return Math.round(base + genderAdjustment);
}

/**
 * Mapeia nível de atividade para fator multiplicador do TDEE
 */
function getActivityFactor(activity_level: string): number {
  const factors: Record<string, number> = {
    sedentary: 1.2, // Pouco ou nenhum exercício
    light: 1.375, // Exercício leve 1-3 dias/semana
    moderate: 1.55, // Exercício moderado 3-5 dias/semana
    active: 1.725, // Exercício intenso 6-7 dias/semana
    very_active: 1.9, // Exercício muito intenso, trabalho físico
  };

  return factors[activity_level] || 1.2;
}

/**
 * Calcula ajuste calórico baseado no objetivo
 */
function getCalorieAdjustment(diet_goal: string): number {
  const adjustments: Record<string, number> = {
    weight_loss: -500, // Déficit de 500 kcal/dia = ~0.5kg/semana
    weight_gain: 500, // Superávit de 500 kcal/dia = ~0.5kg/semana
    maintain: 0, // Manutenção
  };

  return adjustments[diet_goal] || 0;
}

/**
 * Calcula distribuição de macros otimizada por objetivo
 */
function calculateMacros(
  daily_calories: number,
  weight_kg: number,
  diet_goal: string,
): { protein_g: number; carbs_g: number; fat_g: number } {
  // Proteína: prioridade para preservar massa muscular
  let protein_g_per_kg = 1.6; // Padrão para manutenção

  if (diet_goal === "weight_loss") {
    protein_g_per_kg = 2.0; // Mais proteína para preservar massa magra
  } else if (diet_goal === "weight_gain") {
    protein_g_per_kg = 2.2; // Mais proteína para hipertrofia
  }

  const protein_g = Math.round(weight_kg * protein_g_per_kg);
  const protein_calories = protein_g * 4; // 4 kcal/g

  // Gordura: 25-30% das calorias (essencial para hormônios)
  const fat_percentage = 0.28; // 28% é um bom meio termo
  const fat_calories = daily_calories * fat_percentage;
  const fat_g = Math.round(fat_calories / 9); // 9 kcal/g

  // Carboidratos: restante das calorias
  const carbs_calories = daily_calories - protein_calories - fat_calories;
  const carbs_g = Math.round(carbs_calories / 4); // 4 kcal/g

  return { protein_g, carbs_g, fat_g };
}

export const calculateMacrosTool = createTool({
  id: "calculate_macros",
  description:
    "Utilize está tool quando o usuário perguntar quantas calorias ele terá que consumir" +
    "Não utilize essa tool para calcular os alimentos, para calcular alimentos utilize calculate-nutrition" +
    "Calcula metas nutricionais (calorias e macros) baseado no perfil do usuário. " +
    "Usa fórmula de Mifflin-St Jeor para TMB e distribui macros otimizados por objetivo. " +
    "Use quando precisar calcular quantidades para um plano alimentar ou quando o usuário " +
    "perguntar quantas calorias/proteínas deve consumir. Pode sobrescrever valores do perfil se necessário.",
  inputSchema: calculateMacrosToolInput,
  outputSchema: calculateMacrosToolOutput,
  execute: async (inputData, executionContext) => {
    const {
      override_weight_kg,
      override_height_cm,
      override_age,
      override_gender,
      override_activity_level,
      override_diet_goal,
    } = inputData;

    // Resolve user ID from execution context
    const { userId } = extractAuthContext(executionContext);
    logger.info(
      `🧮 [Tool:calculateMacros] Calculando macros para usuário: ${userId}`,
    );

    try {
      // Carrega perfil do usuário (se não houver overrides)
      let profile = null;
      let weight_kg = override_weight_kg;
      let height_cm = override_height_cm;
      let age = override_age;
      let gender = override_gender;
      let activity_level = override_activity_level;
      let diet_goal = override_diet_goal;

      // Se faltam dados obrigatórios, tenta carregar do perfil
      if (
        !weight_kg ||
        !height_cm ||
        !age ||
        !gender ||
        !activity_level ||
        !diet_goal
      ) {
        if (userId === "anonymous") {
          throw new Error(
            "Dados insuficientes para calcular macros. Forneça peso, altura, idade, gênero, nível de atividade e objetivo, ou crie um perfil.",
          );
        }

        profile = await getUserProfileFromDB(userId);

        if (!profile) {
          throw new Error(
            "Perfil não encontrado. Crie um perfil primeiro ou forneça todos os dados necessários.",
          );
        }

        // Usa valores do perfil quando não há override
        weight_kg = weight_kg || profile.weight;
        height_cm = height_cm || profile.height;
        age = age || profile.age;
        gender =
          gender ||
          (profile.gender?.toLowerCase() as "male" | "female" | undefined);
        activity_level = activity_level || profile.activity_level;
        diet_goal = diet_goal || profile.goal;
      }

      // Valida que todos os dados necessários estão disponíveis
      if (
        !weight_kg ||
        !height_cm ||
        !age ||
        !gender ||
        !activity_level ||
        !diet_goal
      ) {
        const missingFields: string[] = [];
        if (!weight_kg) missingFields.push("peso (override_weight_kg)");
        if (!height_cm) missingFields.push("altura (override_height_cm)");
        if (!age) missingFields.push("idade (override_age)");
        if (!gender) missingFields.push("gênero (override_gender)");
        if (!activity_level) missingFields.push("nível de atividade (override_activity_level)");
        if (!diet_goal) missingFields.push("objetivo (override_diet_goal)");
        throw new Error(
          `Dados incompletos para calcular macros. Campos faltando: ${missingFields.join(", ")}. ` +
          `Peça ao usuário esses dados e chame a tool novamente usando os parâmetros override_* correspondentes.`,
        );
      }

      // Normaliza gender
      if (!["male", "female", "non_binary"].includes(gender)) {
        // Tenta mapear valores comuns
        if (gender.includes("masc") || gender.includes("homem")) {
          gender = "male";
        } else if (gender.includes("fem") || gender.includes("mulher")) {
          gender = "female";
        } else if (
          gender.includes("nb") ||
          gender.includes("não binár") ||
          gender.includes("nao binar") ||
          gender.includes("non")
        ) {
          gender = "non_binary";
        } else {
          throw new Error(
            `Gênero inválido: ${gender}. Use 'male', 'female' ou 'non_binary'.`,
          );
        }
      }

      logger.info(
        `   Perfil: ${weight_kg}kg, ${height_cm}cm, ${age} anos, ${gender}`,
      );
      logger.info(`   Atividade: ${activity_level}, Objetivo: ${diet_goal}`);

      // 1. Calcula TMB (Taxa Metabólica Basal)
      const tmb = calculateTMB(weight_kg, height_cm, age, gender);
      logger.info(`   TMB: ${tmb} kcal/dia`);

      // 2. Calcula TDEE (Total Daily Energy Expenditure)
      const activityFactor = getActivityFactor(activity_level);
      const tdee = Math.round(tmb * activityFactor);
      logger.info(`   TDEE: ${tdee} kcal/dia (fator ${activityFactor})`);

      // 3. Aplica ajuste calórico baseado no objetivo
      const calorieAdjustment = getCalorieAdjustment(diet_goal);
      const daily_calories = tdee + calorieAdjustment;
      logger.info(
        `   Calorias ajustadas: ${daily_calories} kcal/dia (${calorieAdjustment >= 0 ? "+" : ""}${calorieAdjustment})`,
      );

      // 4. Calcula distribuição de macros
      const macros = calculateMacros(daily_calories, weight_kg, diet_goal);
      logger.info(
        `   Macros: ${macros.protein_g}g proteína, ${macros.carbs_g}g carbos, ${macros.fat_g}g gordura`,
      );

      // 5. Cria explicação em português
      const goalNames: Record<string, string> = {
        weight_loss: "perda de peso",
        weight_gain: "ganho de peso",
        maintain: "manutenção",
      };

      const activityNames: Record<string, string> = {
        sedentary: "sedentário",
        light: "levemente ativo",
        moderate: "moderadamente ativo",
        active: "muito ativo",
        very_active: "extremamente ativo",
      };

      const explanation = `
Baseado no seu perfil (${weight_kg}kg, ${height_cm}cm, ${age} anos, ${gender === "male" ? "masculino" : gender === "non_binary" ? "não binário" : "feminino"}):

📊 **Cálculos Nutricionais**
• TMB (metabolismo basal): ${tmb} kcal/dia
• TDEE (gasto total com atividade ${activityNames[activity_level]}): ${tdee} kcal/dia
• Meta ajustada para ${goalNames[diet_goal]}: ${daily_calories} kcal/dia

🍽️ **Distribuição de Macros**
• Proteína: ${macros.protein_g}g/dia (${(macros.protein_g / weight_kg).toFixed(1)}g/kg)
• Carboidratos: ${macros.carbs_g}g/dia
• Gordura: ${macros.fat_g}g/dia

💡 **Nota**: Estes valores são estimativas. Ajuste conforme necessário baseado nos resultados.
`.trim();

      logger.info(`✅ [Tool:calculateMacros] Cálculo concluído com sucesso`);

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
          diet_goal,
        },
        explanation,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Erro desconhecido";
      logger.error(`❌ [Tool:calculateMacros] Erro: ${errorMessage}`);

      throw new Error(`Erro ao calcular macros: ${errorMessage}`);
    }
  },
});
