import { generateText } from "ai";
import type { LanguageModel } from "ai";

export type ConversationMessage = { role: "user" | "assistant"; content: string };
export type SummaryResult = { summary: string; tokensSaved: number };

export async function summarizeHistory(
  messages: ConversationMessage[],
  model: LanguageModel,
): Promise<SummaryResult> {
  if (messages.length <= 6) {
    return { summary: "", tokensSaved: 0 };
  }

  const toSummarize = messages.slice(0, -3);
  const charCount = toSummarize.reduce((acc, m) => acc + m.content.length, 0);
  const tokensSaved = Math.round(charCount / 4);

  const transcript = toSummarize
    .map((m) => `${m.role === "user" ? "Usuário" : "Assistente"}: ${m.content}`)
    .join("\n");

  const { text } = await generateText({
    model,
    messages: [
      {
        role: "user",
        content: `Resuma a conversa abaixo de forma compacta, focando em:
- Preferências e restrições alimentares mencionadas pelo usuário
- Objetivos discutidos
- Refeições já registradas ou planejadas
- Decisões tomadas

Seja conciso. Use bullets. Não repita informações do perfil oficial.

CONVERSA:
${transcript}`,
      },
    ],
  });

  return { summary: text, tokensSaved };
}

export function injectSummaryAsContext(summary: string): { role: "system"; content: string } {
  return {
    role: "system",
    content: `## Resumo da conversa anterior\n${summary}`,
  };
}
