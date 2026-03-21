import { describe, it, expect } from "vitest";
import { extractAuthContext } from "../../src/mastra/utils/auth-context";
import { asyncContext } from "../../src/lib/async-context";

function mockContext(userId?: string, token?: string) {
  const map = new Map<string, string>();
  if (userId) map.set("mastra__resourceId", userId);
  if (token) map.set("jwt_token", token);
  return { requestContext: map };
}

describe("extractAuthContext", () => {
  it("extracts userId and authToken from context", () => {
    const { userId, authToken } = extractAuthContext(mockContext("u1", "tok1"));
    expect(userId).toBe("u1");
    expect(authToken).toBe("tok1");
  });

  it("returns anonymous and undefined token when context is undefined", () => {
    const { userId, authToken } = extractAuthContext(undefined);
    expect(userId).toBe("anonymous");
    expect(authToken).toBeUndefined();
  });

  it("returns anonymous when resourceId not set", () => {
    const { userId } = extractAuthContext(mockContext(undefined, "tok"));
    expect(userId).toBe("anonymous");
  });

  it("returns undefined token when jwt_token not set", () => {
    const { authToken } = extractAuthContext(mockContext("u1"));
    expect(authToken).toBeUndefined();
  });

  it("falls back to AsyncLocalStorage when requestContext is empty", () => {
    asyncContext.run({ userId: "als-user", jwtToken: "als-tok" }, () => {
      const { userId, authToken } = extractAuthContext(undefined);
      expect(userId).toBe("als-user");
      expect(authToken).toBe("als-tok");
    });
  });

  it("falls back to AsyncLocalStorage when requestContext has no resourceId", () => {
    asyncContext.run({ userId: "als-user", jwtToken: "als-tok" }, () => {
      const { userId, authToken } = extractAuthContext({
        requestContext: new Map(),
      });
      expect(userId).toBe("als-user");
      expect(authToken).toBe("als-tok");
    });
  });

  it("prefers requestContext over AsyncLocalStorage", () => {
    asyncContext.run({ userId: "als-user", jwtToken: "als-tok" }, () => {
      const { userId, authToken } = extractAuthContext(
        mockContext("rc-user", "rc-tok"),
      );
      expect(userId).toBe("rc-user");
      expect(authToken).toBe("rc-tok");
    });
  });
});
