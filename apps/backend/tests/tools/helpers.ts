import { vi } from "vitest";
import { MASTRA_RESOURCE_ID_KEY } from "@mastra/core/request-context";

/**
 * Creates a fake Mastra execution context with resourceId and jwt_token.
 */
export function createMockExecutionContext(
  userId = "test-user-123",
  token = "mock-jwt-token",
) {
  const contextMap = new Map<string, string>();
  contextMap.set(MASTRA_RESOURCE_ID_KEY, userId);
  contextMap.set("jwt_token", token);

  return {
    requestContext: contextMap,
  };
}
