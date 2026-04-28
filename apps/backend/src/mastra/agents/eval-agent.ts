import { Agent } from "@mastra/core/agent";
import { env } from "../config/env";
import { NutriaProcessor } from "../processors/NutriaProcessor";

/**
 * Creates a stateless eval agent with custom instructions.
 * Same tools and model as the production agent — no memory (reproducible results).
 */
export function createEvalAgent(instructions: string): Agent {
  return new Agent({
    id: "eval-agent",
    name: "eval-agent",
    instructions,
    model: env.MODEL,
    inputProcessors: [new NutriaProcessor(5)],
    tools: {},
  });
}
