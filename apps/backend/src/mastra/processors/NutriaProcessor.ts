/**
 * NutriaProcessor
 *
 * Single processor for the nutrition analyst agent.
 * - Steps 0..maxSteps-2: inject tools based on user intent
 *   (regex fast-path + small AI model fallback)
 * - Step maxSteps-1: inject no tools, forcing the agent to produce
 *   a final answer instead of calling another tool
 */

import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import type {
  Processor,
  ProcessInputStepArgs,
  ProcessInputStepResult,
} from "@mastra/core/processors";

import { searchFoodCatalogTool } from "../tools/search-food-catalog";
import { calculateNutritionTool } from "../tools/calculate-nutrition";
import { findSimilarFoodsTool } from "../tools/find-similar-foods";
import { recommendationTool } from "../tools/recommendation";
import { logMealTool } from "../tools/log-meal";
import { getDailySummaryTool } from "../tools/get-daily-summary";
import { getWeeklyStatsTool } from "../tools/get-weekly-stats";
import { createMealPlanTool } from "../tools/create-meal-plan";
import { listMealPlansTool } from "../tools/list-meal-plans";
import { getMealPlanTool } from "../tools/get-meal-plan";
import { updateMealPlanTool } from "../tools/update-meal-plan";
import { deleteMealPlanTool } from "../tools/delete-meal-plan";
import { confirmAndLogImageMealTool } from "../tools/confirm-and-log-image-meal";
import { updateUserProfileTool } from "../tools/update-user-profile";
import { calculateMacrosTool } from "../tools/calculate-macros";
import { exportMealPlanPdfTool } from "../tools/export-meal-plan-pdf";
import { searchRecipesTool } from "../tools/search-recipes";
import { getRecipeTool } from "../tools/get-recipe";
import { addGoalTool } from "../tools/add-goal";
import { addActivityTool } from "../tools/add-activity";
import { suggestRecipeTool } from "../tools/suggest-recipe";

// -----------------------------------------------------------------------
// Tool sets
// -----------------------------------------------------------------------

const STATIC_TOOLS = {
  add_goal: addGoalTool,
  add_activity: addActivityTool,
  save_recipe: suggestRecipeTool,
};

const ALL_TOOLS = {
  ...STATIC_TOOLS,
  searchFoodCatalogTool,
  calculateNutritionTool,
  findSimilarFoodsTool,
  recommendationTool,
  logMealTool,
  getDailySummaryTool,
  getWeeklyStatsTool,
  createMealPlanTool,
  listMealPlansTool,
  getMealPlanTool,
  updateMealPlanTool,
  deleteMealPlanTool,
  confirmAndLogImageMealTool,
  updateUserProfileTool,
  calculateMacrosTool,
  exportMealPlanPdfTool,
  searchRecipesTool,
  getRecipeTool,
};

const INTENT_TOOLS: Record<string, Record<string, unknown>> = {
  search_food: {
    ...STATIC_TOOLS,
    searchFoodCatalogTool,
    calculateNutritionTool,
    findSimilarFoodsTool,
  },
  log_meal: {
    ...STATIC_TOOLS,
    logMealTool,
    searchFoodCatalogTool,
    calculateNutritionTool,
    confirmAndLogImageMealTool,
  },
  daily_summary: {
    ...STATIC_TOOLS,
    getDailySummaryTool,
    logMealTool,
  },
  weekly_stats: {
    ...STATIC_TOOLS,
    getWeeklyStatsTool,
    getDailySummaryTool,
  },
  meal_plan: {
    ...STATIC_TOOLS,
    createMealPlanTool,
    listMealPlansTool,
    getMealPlanTool,
    updateMealPlanTool,
    deleteMealPlanTool,
    exportMealPlanPdfTool,
    calculateMacrosTool,
  },
  calculate_macros: {
    ...STATIC_TOOLS,
    calculateMacrosTool,
    updateUserProfileTool,
  },
  recipes: {
    ...STATIC_TOOLS,
    searchRecipesTool,
    getRecipeTool,
    suggestRecipeTool,
    searchFoodCatalogTool,
  },
  recommendation: {
    ...STATIC_TOOLS,
    recommendationTool,
    searchFoodCatalogTool,
    calculateMacrosTool,
  },
  profile: {
    ...STATIC_TOOLS,
    updateUserProfileTool,
    calculateMacrosTool,
  },
  general: ALL_TOOLS,
};

// -----------------------------------------------------------------------
// Intent detection
// -----------------------------------------------------------------------

const VALID_INTENTS = [
  "search_food",
  "log_meal",
  "daily_summary",
  "weekly_stats",
  "meal_plan",
  "calculate_macros",
  "recipes",
  "recommendation",
  "profile",
  "general",
] as const;

type Intent = (typeof VALID_INTENTS)[number];

const INTENT_PATTERNS: Array<{ intent: Intent; pattern: RegExp }> = [
  {
    intent: "log_meal",
    pattern:
      /\b(registrar?|logar?|registrei|logei|comi|tomei|bebi|comer?|beber?|café\s+da\s+manhã|almoç[ao]|jantar|lanche[i]?|refeição|adicion[ao]r?\s+(refeição|alimento|comida))\b/i,
  },
  {
    intent: "daily_summary",
    pattern:
      /\b(resumo\s+de\s+hoje|o\s+que\s+(eu\s+)?comi\s+hoje|diário\s+de\s+hoje|resumo\s+diário|summary|hoje\s+comi|quanto\s+comi\s+hoje|consumo\s+de\s+hoje)\b/i,
  },
  {
    intent: "weekly_stats",
    pattern:
      /\b(estatísticas|progresso\s+da\s+semana|semana[l]?|semanais|como\s+foi\s+minha\s+semana|evolução)\b/i,
  },
  {
    intent: "meal_plan",
    pattern:
      /\b(plano\s+alimentar|plano\s+de\s+(refeição|alimentação|dieta)|cardápio|criar\s+plano|montar\s+plano|gerar\s+plano|ver\s+meu\s+plano|meu\s+plano)\b/i,
  },
  {
    intent: "calculate_macros",
    pattern:
      /\b(quantas\s+calorias\s+(devo|posso|preciso)|meta\s+calórica|meu[s]?\s+macros?|calcular\s+macros?|tmb|tdee|gasto\s+calórico|calorias\s+diárias)\b/i,
  },
  {
    intent: "recipes",
    pattern:
      /\b(receita|como\s+preparar|como\s+fazer|ingrediente[s]?|modo\s+de\s+preparo)\b/i,
  },
  {
    intent: "recommendation",
    pattern:
      /\b(recomendar?|recomendação|sugestão|sugerir?|me\s+indica|o\s+que\s+(devo|posso)\s+comer|me\s+ajuda\s+a\s+escolher)\b/i,
  },
  {
    intent: "profile",
    pattern:
      /\b(atualizar?\s+(meu\s+)?perfil|meu\s+peso|minha\s+altura|minha\s+idade|meu\s+objetivo|minha\s+meta|nível\s+de\s+atividade|dados\s+pessoais)\b/i,
  },
  {
    intent: "search_food",
    pattern:
      /\b(buscar?|procurar?|encontrar?|pesquisar?|calorias\s+d[oe]|informações\s+de|valor\s+nutricional|macros\s+d[oe]|alimento|comida)\b/i,
  },
];

function detectIntentByRegex(text: string): Intent | null {
  for (const { intent, pattern } of INTENT_PATTERNS) {
    if (pattern.test(text)) return intent;
  }
  return null;
}

async function detectIntentByModel(text: string): Promise<Intent> {
  try {
    const github = createOpenAI({
      apiKey: process.env.GITHUB_TOKEN || "",
      baseURL: "https://models.inference.ai.azure.com",
    });
    const model = github(process.env.INTENT_MODEL || "Phi-4-mini");
    const { text: raw } = await generateText({
      model,
      system:
        "You are an intent classifier for a nutrition app. " +
        "The user writes in Portuguese. Reply with ONLY ONE WORD from this list — nothing else:\n" +
        "search_food, log_meal, daily_summary, weekly_stats, meal_plan, " +
        "calculate_macros, recipes, recommendation, profile, general",
      prompt: text,
      maxOutputTokens: 10,
    });
    const normalized = raw
      .trim()
      .toLowerCase()
      .replace(/[^a-z_]/g, "") as Intent;
    return VALID_INTENTS.includes(normalized) ? normalized : "general";
  } catch {
    return "general";
  }
}

// -----------------------------------------------------------------------
// Processor
// -----------------------------------------------------------------------

export class NutriaProcessor implements Processor {
  readonly id = "nutria-processor";
  readonly name = "NutriaProcessor";
  readonly description =
    "Injects tools by intent (steps 0..N-2); removes tools on the last step to force a final answer";

  private readonly maxSteps: number;

  constructor(maxSteps = 5) {
    this.maxSteps = maxSteps;
  }

  async processInputStep({
    stepNumber,
    messages,
    state,
  }: ProcessInputStepArgs): Promise<ProcessInputStepResult> {
    // Last step: no tools — agent must produce a final answer
    if (stepNumber >= this.maxSteps - 1) {
      return { tools: {} };
    }

    // Classify intent once per request (step 0), cache in state
    if (stepNumber === 0) {
      const lastUser = [...messages].reverse().find((m) => m.role === "user");
      const userText =
        typeof lastUser?.content === "string"
          ? lastUser.content
          : Array.isArray(lastUser?.content)
            ? lastUser.content
                .filter((p: any) => p.type === "text")
                .map((p: any) => p.text)
                .join(" ")
            : "";

      state.intent = userText
        ? (detectIntentByRegex(userText) ?? (await detectIntentByModel(userText)))
        : "general";
    }

    const intent = (state.intent as Intent) ?? "general";
    return { tools: INTENT_TOOLS[intent] ?? ALL_TOOLS };
  }
}
