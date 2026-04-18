import { Agent } from "@mastra/core/agent";
import { env } from "../config/env";
import { loadNutritionAnalystInstructions } from "../utils/context-loader";
import { createNutritionMemory } from "../config/memory";
import { NutriaProcessor } from "../config/NutriaProcessor";

export const nutritionAnalystAgent = new Agent({
  id: "nutrition-analyst",
  name: "nutrition-analyst",
  description:
    "Agente especializado em análise nutricional, identificação de alimentos em imagens e busca de alimentos",
  instructions: loadNutritionAnalystInstructions(),
  model: env.MODEL,
  memory: createNutritionMemory(),
  inputProcessors: [new NutriaProcessor(5)],
  tools: {},
});
