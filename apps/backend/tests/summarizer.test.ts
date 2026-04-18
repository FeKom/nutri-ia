import { describe, it, expect, vi } from "vitest";
import { summarizeHistory, injectSummaryAsContext } from "../src/mastra/config/summarizer";

vi.mock("ai", () => ({
  generateText: vi.fn().mockResolvedValue({ text: "Resumo gerado pelo mock." }),
}));

const msg = (role: "user" | "assistant", content: string) => ({ role, content });

describe("summarizeHistory", () => {
  it("returns empty summary when messages <= 6", async () => {
    const messages = [
      msg("user", "Olá"),
      msg("assistant", "Oi!"),
      msg("user", "O que devo comer?"),
    ];
    const model = {} as any;
    const result = await summarizeHistory(messages, model);
    expect(result.summary).toBe("");
    expect(result.tokensSaved).toBe(0);
  });

  it("returns empty summary for exactly 6 messages", async () => {
    const messages = Array.from({ length: 6 }, (_, i) =>
      msg(i % 2 === 0 ? "user" : "assistant", `Mensagem ${i}`),
    );
    const result = await summarizeHistory(messages, {} as any);
    expect(result.summary).toBe("");
  });

  it("calls LLM and returns summary when messages > 6", async () => {
    const messages = Array.from({ length: 9 }, (_, i) =>
      msg(i % 2 === 0 ? "user" : "assistant", `Mensagem ${i} com algum conteúdo`),
    );
    const model = {} as any;
    const result = await summarizeHistory(messages, model);
    expect(result.summary).toBe("Resumo gerado pelo mock.");
    expect(result.tokensSaved).toBeGreaterThan(0);
  });

  it("estimates tokensSaved as chars / 4", async () => {
    const messages = Array.from({ length: 9 }, (_, i) =>
      msg(i % 2 === 0 ? "user" : "assistant", "1234"), // 4 chars each
    );
    // summarizes messages 0..5 (6 messages, -3 kept) = messages slice(0, -3) = 6 messages
    // 6 * 4 chars = 24 chars → 24 / 4 = 6 tokens saved
    const result = await summarizeHistory(messages, {} as any);
    expect(result.tokensSaved).toBe(6);
  });
});

describe("injectSummaryAsContext", () => {
  it("returns a system role message", () => {
    const msg = injectSummaryAsContext("Usuário quer perder peso.");
    expect(msg.role).toBe("system");
  });

  it("formats summary with header", () => {
    const msg = injectSummaryAsContext("Usuário quer perder peso.");
    expect(msg.content).toContain("## Resumo da conversa anterior");
    expect(msg.content).toContain("Usuário quer perder peso.");
  });
});
