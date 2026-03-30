import { Agent } from "@mastra/core/agent";
import { env } from "../config/env";
import { toolSearch } from "../config/toolProcessor";
import { createUserProfileTool } from "../tools/create-user-profile";
import { updateUserProfileTool } from "../tools/update-user-profile";
import { calculateMacrosTool } from "../tools/calculate-macros";
import { createMealPlanTool } from "../tools/create-meal-plan";

/**
 * Creates a stateless eval agent with custom instructions.
 * Same tools and model as the production agent — no memory (reproducible results).
 */
export function createEvalAgent(instructions: string): Agent {
  return new Agent({
    name: "eval-agent",
    instructions,
    model: env.MODEL,
    inputProcessors: [toolSearch],
    tools: {
      create_user_profile: createUserProfileTool,
      update_user_profile: updateUserProfileTool,
      calculate_macros: calculateMacrosTool,
      create_meal_plan: createMealPlanTool,
    },
  });
}
