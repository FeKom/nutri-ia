import { MASTRA_RESOURCE_ID_KEY } from "@mastra/core/request-context";
import {
  getCurrentUserId,
  getCurrentJwtToken,
} from "../../lib/async-context";

export interface AuthContext {
  userId: string;
  authToken: string | undefined;
}

/**
 * Extracts userId and JWT token from the Mastra execution context.
 * Falls back to AsyncLocalStorage when the Mastra requestContext
 * is empty (known framework bug in v1.4.0).
 * Returns "anonymous" and undefined if both sources are missing.
 */
export function extractAuthContext(executionContext: any): AuthContext {
  const userId =
    (executionContext?.requestContext?.get(MASTRA_RESOURCE_ID_KEY) as string) ||
    getCurrentUserId();
  const authToken =
    (executionContext?.requestContext?.get("jwt_token") as string | undefined) ||
    getCurrentJwtToken();

  return { userId, authToken };
}
