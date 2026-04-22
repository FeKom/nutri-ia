import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: vi.fn(() => vi.fn(() => ({}))),
}));

vi.mock("ai", () => ({
  generateText: vi.fn(),
}));

import { generateText } from "ai";
import { generateHypotheticalDocument, hydeSearch } from "../src/mastra/config/hyde";

const mockGenerateText = vi.mocked(generateText);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("generateHypotheticalDocument", () => {
  it("returns LLM-generated hypothetical document", async () => {
    mockGenerateText.mockResolvedValue({ text: "Frango grelhado, rico em proteínas." } as any);
    const result = await generateHypotheticalDocument("fonte de proteína magra");
    expect(result).toBe("Frango grelhado, rico em proteínas.");
  });

  it("returns original query as fallback on LLM error", async () => {
    mockGenerateText.mockRejectedValue(new Error("API timeout"));
    const result = await generateHypotheticalDocument("fonte de proteína");
    expect(result).toBe("fonte de proteína");
  });

  it("trims whitespace from LLM response", async () => {
    mockGenerateText.mockResolvedValue({ text: "  Alimento rico em fibras.  " } as any);
    const result = await generateHypotheticalDocument("fibras");
    expect(result).toBe("Alimento rico em fibras.");
  });
});

describe("hydeSearch", () => {
  it("returns concatenation of original query and hypothetical doc", async () => {
    mockGenerateText.mockResolvedValue({ text: "Atum em lata, proteína magra." } as any);
    const result = await hydeSearch("proteína barata");
    expect(result).toBe("proteína barata Atum em lata, proteína magra.");
  });

  it("still returns a string on LLM failure (fallback = original query duplicated)", async () => {
    mockGenerateText.mockRejectedValue(new Error("fail"));
    const result = await hydeSearch("arroz");
    // fallback returns original query → "arroz arroz"
    expect(result).toBe("arroz arroz");
    expect(typeof result).toBe("string");
  });
});
