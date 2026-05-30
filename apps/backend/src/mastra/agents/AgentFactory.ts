import { Agent } from "@mastra/core/agent";
import type { AgentConfig } from "@mastra/core/agent";
import { env } from "../config/env";
import { NutriaProcessor } from "../processors/NutriaProcessor";
import { createNutritionMemory } from "../config/memory";
import {
  promptInjectionDetector,
  inputModerationProcessor,
  piiDetector,
  outputModerationProcessor,
  nutritionalOutputGuardrail,
} from "../config/guardrails";
import {
  loadNutritionAnalystInstructions,
  loadChefInstructions,
} from "../utils/context-loader";
import { ALL_TOOLS } from "../tools";

export class AgentFactory {
  static nutritionAnalyst() {
    const config: AgentConfig = {
      id: "nutrition-analyst",
      name: "nutrition-analyst",
      description:
        "Agente especializado em análise nutricional, identificação de alimentos em imagens e busca de alimentos",
      instructions: loadNutritionAnalystInstructions(),
      model: env.MODEL,
      memory: createNutritionMemory(),
      tools: ALL_TOOLS.NUTRITION_TOOLS,
      inputProcessors: [
        promptInjectionDetector,
        inputModerationProcessor,
        piiDetector,
        new NutriaProcessor(5),
      ],
      outputProcessors: [outputModerationProcessor, nutritionalOutputGuardrail],
    };
    return new Agent(config);
  }

  static eval(instructions: string) {
    const config: AgentConfig = {
      id: "eval-agent",
      name: "eval-agent",
      instructions,
      model: env.MODEL,
      inputProcessors: [new NutriaProcessor(5)],
      tools: {},
    };
    return new Agent(config);
  }
  static chefAgent() {
    const config: AgentConfig = {
      id: "executive chef",
      name: "executive chef",
      description:
        "Agent expecializado em criar e recomendar receitas, fazendo chunk retrieval de pdfs",
      instructions: loadChefInstructions(),
      model: env.MODEL,
      tools: ALL_TOOLS.RECIPE_TOOLS,
      inputProcessors: [
        promptInjectionDetector,
        inputModerationProcessor,
        piiDetector,
        new NutriaProcessor(5),
      ],
      outputProcessors: [outputModerationProcessor, nutritionalOutputGuardrail],
    };
    return new Agent(config);
  }
}
