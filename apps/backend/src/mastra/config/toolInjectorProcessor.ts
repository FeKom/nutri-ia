/**
 * Tool Injector Processor
 *
 * Injects tools into each agent step based on the user's intent.
 * Uses a two-pass approach:
 *   1. Regex fast-path: covers ~90% of cases instantly
 *   2. Small AI model fallback: classifies ambiguous messages
 *
 * This replaces ToolSearchProcessor — instead of the agent calling
 * `search_tools` + `load_tool` meta-tools (2 extra steps per turn),
 * tools are injected before the first LLM call.
 */

import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import type {
  Processor,
  ProcessInputStepArgs,
  ProcessInputStepResult,
} from "@mastra/core/processors";

// Dynamic tools (previously in ToolSearchProcessor)
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

// Static tools (always available regardless of intent)
import { addGoalTool } from "../tools/add-goal";
import { addActivityTool } from "../tools/add-activity";
import { suggestRecipeTool } from "../tools/suggest-recipe";

const STATIC_TOOLS = {
  add_goal: addGoalTool,
  add_activity: addActivityTool,
  save_recipe: suggestRecipeTool,
};

// All tools bundled together for general/unknown intent
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

// -----------------------------------------------------------------------
// Intent → tools map
// Keep tool sets focused so the agent token budget isn't wasted on noise.
// -----------------------------------------------------------------------
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
// Regex fast-path — covers the common Portuguese patterns
// -----------------------------------------------------------------------
const INTENT_PATTERNS: Array<{ intent: string; pattern: RegExp }> = [
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

// -----------------------------------------------------------------------
// Intent classifier model (GitHub Models via AI SDK)
// -----------------------------------------------------------------------
const github = createOpenAI({
  apiKey: process.env.GITHUB_TOKEN || "",
  baseURL: "https://models.inference.ai.azure.com",
});

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

function detectIntentByRegex(text: string): Intent | null {
  for (const { intent, pattern } of INTENT_PATTERNS) {
    if (pattern.test(text)) {
      return intent as Intent;
    }
  }
  return null;
}

async function detectIntentByModel(text: string): Promise<Intent> {
  try {
    const intentModel = github(process.env.INTENT_MODEL || "Phi-4-mini");
    const { text: raw } = await generateText({
      model: intentModel,
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
// Processor implementation
// -----------------------------------------------------------------------
export class ToolInjectorProcessor implements Processor {
  readonly id = "tool-injector-processor";
  readonly name = "Tool Injector";
  readonly description =
    "Injects relevant tools based on user intent (regex fast-path + AI fallback)";

  async processInputStep({
    stepNumber,
    messages,
    state,
  }: ProcessInputStepArgs): Promise<ProcessInputStepResult> {
    // Classify intent only once per request (step 0), then cache in state
    if (stepNumber === 0) {
      const lastUser = [...messages]
        .reverse()
        .find((m) => m.role === "user");

      const userText =
        typeof lastUser?.content === "string"
          ? lastUser.content
          : Array.isArray(lastUser?.content)
            ? lastUser.content
                .filter((p: any) => p.type === "text")
                .map((p: any) => p.text)
                .join(" ")
            : "";

      if (userText) {
        const regexIntent = detectIntentByRegex(userText);
        state.intent = regexIntent ?? (await detectIntentByModel(userText));
      } else {
        state.intent = "general";
      }
    }

    const intent = (state.intent as Intent) ?? "general";
    const tools = INTENT_TOOLS[intent] ?? ALL_TOOLS;

    return { tools };
  }
}

export const toolInjectorProcessor = new ToolInjectorProcessor();
