import { describe, it, expect } from "vitest";
import { validateAgentResponse, applyGuardrails } from "../src/mastra/config/guardrails";
import type { UserProfile } from "../src/mastra/config/memory";

const baseProfile: UserProfile = {
  id: "user-1",
  name: "Test",
  allergies: [],
  restrictions: [],
  dislikes: [],
  goal: "maintain",
  activity_level: "moderate",
};

describe("validateAgentResponse", () => {
  it("flags responses shorter than 5 characters", () => {
    const result = validateAgentResponse("ok", null);
    expect(result.safe).toBe(false);
    expect(result.reason).toBe("response_too_short");
  });

  it("passes a normal safe response", () => {
    const result = validateAgentResponse("Arroz integral é uma ótima fonte de carboidratos.", null);
    expect(result.safe).toBe(true);
  });

  it("flags medical claim: 'vai curar'", () => {
    const result = validateAgentResponse("Este alimento vai curar sua doença.", null);
    expect(result.safe).toBe(false);
    expect(result.reason).toBe("medical_claim_detected");
  });

  it("flags medical claim: 'trata diabetes'", () => {
    const result = validateAgentResponse("A canela trata diabetes tipo 2.", null);
    expect(result.safe).toBe(false);
    expect(result.reason).toBe("medical_claim_detected");
  });

  it("flags medical claim: 'diagnóstico'", () => {
    const result = validateAgentResponse("Baseado nos seus sintomas, meu diagnóstico é...", null);
    expect(result.safe).toBe(false);
    expect(result.reason).toBe("medical_claim_detected");
  });

  it("flags hallucinated calorie value over 9000", () => {
    const result = validateAgentResponse("Este prato tem 9500 kcal por porção.", null);
    expect(result.safe).toBe(false);
    expect(result.reason).toBe("calorie_hallucination");
  });

  it("flags Brazilian-formatted calorie value: '9.500 kcal'", () => {
    const result = validateAgentResponse("Este prato tem 9.500 kcal por porção.", null);
    expect(result.safe).toBe(false);
    expect(result.reason).toBe("calorie_hallucination");
  });

  it("allows calorie values under 9000", () => {
    const result = validateAgentResponse("Um Big Mac tem aproximadamente 550 kcal.", null);
    expect(result.safe).toBe(true);
  });

  it("appends allergen note when allergen is mentioned without warning", () => {
    const profile: UserProfile = { ...baseProfile, allergies: ["amendoim"] };
    const result = validateAgentResponse("Você pode comer pasta de amendoim.", profile);
    expect(result.safe).toBe(true);
    expect(result.sanitized).toContain("Atenção às alergias");
  });

  it("does not append allergen note when warning phrase is present", () => {
    const profile: UserProfile = { ...baseProfile, allergies: ["amendoim"] };
    const result = validateAgentResponse("Cuidado, este produto contém amendoim.", profile);
    expect(result.safe).toBe(true);
    expect(result.sanitized).not.toContain("Atenção às alergias");
  });

  it("does not append allergen note when allergen is not mentioned", () => {
    const profile: UserProfile = { ...baseProfile, allergies: ["amendoim"] };
    const result = validateAgentResponse("Frango grelhado é uma ótima opção proteica.", profile);
    expect(result.safe).toBe(true);
    expect(result.sanitized).not.toContain("Atenção às alergias");
  });

  it("does not append allergen note when profile has no allergies", () => {
    const result = validateAgentResponse("Frango com amendoim é saboroso.", baseProfile);
    expect(result.safe).toBe(true);
    expect(result.sanitized).not.toContain("Atenção às alergias");
  });
});

describe("applyGuardrails", () => {
  const makeStream = (chunks: object[]): ReadableStream => {
    return new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk);
        controller.close();
      },
    });
  };

  const collectChunks = async (stream: ReadableStream): Promise<object[]> => {
    const reader = stream.getReader();
    const results: object[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      results.push(value);
    }
    return results;
  };

  it("passes through safe response chunks unchanged", async () => {
    const chunks = [
      { type: "text-start", id: "a" },
      { type: "text-delta", id: "a", textDelta: "Arroz integral é saudável." },
      { type: "text-end", id: "a" },
      { type: "finish", finishReason: "stop" },
    ];
    const result = await collectChunks(applyGuardrails(makeStream(chunks), null));
    expect(result).toEqual(chunks);
  });

  it("replaces unsafe response with fallback chunks", async () => {
    const chunks = [
      { type: "text-start", id: "a" },
      { type: "text-delta", id: "a", textDelta: "Este alimento vai curar sua diabetes." },
      { type: "text-end", id: "a" },
    ];
    const result = await collectChunks(applyGuardrails(makeStream(chunks), null));
    const fallbackText = result.find((c: any) => c.type === "text-delta") as any;
    expect(fallbackText?.textDelta).toContain("nutricionista profissional");
  });

  it("appends allergen note chunk when allergen is mentioned without warning", async () => {
    const profile: UserProfile = { ...baseProfile, allergies: ["nozes"] };
    const chunks = [
      { type: "text-start", id: "a" },
      { type: "text-delta", id: "a", textDelta: "Você pode comer granola com nozes." },
      { type: "text-end", id: "a" },
      { type: "finish", finishReason: "stop" },
    ];
    const result = await collectChunks(applyGuardrails(makeStream(chunks), profile));
    const allText = result
      .filter((c: any) => c.type === "text-delta")
      .map((c: any) => c.textDelta)
      .join("");
    expect(allText).toContain("Atenção às alergias");
  });

  it("passes through non-text responses unchanged (e.g. tool-only)", async () => {
    const chunks = [
      { type: "tool-result", toolCallId: "t1", result: { ok: true } },
      { type: "finish", finishReason: "tool-calls" },
    ];
    const result = await collectChunks(applyGuardrails(makeStream(chunks), null));
    expect(result).toEqual(chunks);
  });
});
