import { createTool } from "@mastra/core/tools";
import type { z } from "zod";
import type { UserProfile } from "../config/memory";
import { asyncContext } from "../../lib/async-context";
import { extractAuthContext } from "./auth-context";

export interface AuthContext {
  userId: string;
  authToken: string | undefined;
  userProfile: UserProfile | null;
}

interface WithAuthConfig<TIn extends z.ZodTypeAny, TOut extends z.ZodTypeAny> {
  id: string;
  description: string;
  inputSchema: TIn;
  outputSchema: TOut;
  execute: (
    input: z.infer<TIn>,
    auth: AuthContext,
  ) => Promise<z.infer<TOut>>;
}

/**
 * Factory that wraps createTool and injects auth context (userId, authToken,
 * userProfile) into every execute call. Tools become pure request/response
 * orchestrators — they never fetch the user profile themselves.
 */
export function withAuth<TIn extends z.ZodTypeAny, TOut extends z.ZodTypeAny>(
  config: WithAuthConfig<TIn, TOut>,
) {
  return createTool({
    id: config.id,
    description: config.description,
    inputSchema: config.inputSchema,
    outputSchema: config.outputSchema,
    execute: async (input: z.infer<TIn>, executionContext: any) => {
      const { userId, authToken } = extractAuthContext(executionContext);
      const userProfile = asyncContext.getStore()?.userProfile ?? null;
      return config.execute(input, { userId, authToken, userProfile });
    },
  });
}
