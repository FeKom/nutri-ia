import type { UserProfile } from "./memory";
import { logger } from "../../utils/logger";

export type GuardrailResult = {
  safe: boolean;
  reason?: string;
  sanitized?: string;
};

// Minimal shape of a UI message chunk emitted by createUIMessageStream
type UIChunk = {
  type: string;
  id?: string;
  textDelta?: string;
  [key: string]: unknown;
};

const MEDICAL_CLAIM_PATTERNS = [
  /vai curar/i,
  /trata diabetes/i,
  /cura obesidade/i,
  /diagnóstico/i,
  /diagnose/i,
];

const CALORIE_REGEX = /(\d[\d,.]*)\s*kcal/gi;
const WARNING_PHRASES = ["verifique", "cuidado", "atenção"];

const ALLERGEN_NOTE =
  "\n\n⚠️ **Atenção às alergias:** Verifique sempre os rótulos dos alimentos para confirmar que não contêm seus alérgenos antes de consumir.";

function parseCalorieValue(raw: string): number {
  // Strip separators — handles both "9.000" (PT) and "9,000" (EN)
  return parseFloat(raw.replace(/[.,]/g, ""));
}

export function validateAgentResponse(
  text: string,
  userProfile: UserProfile | null,
): GuardrailResult {
  if (text.length < 5) {
    return { safe: false, reason: "response_too_short" };
  }

  for (const pattern of MEDICAL_CLAIM_PATTERNS) {
    if (pattern.test(text)) {
      logger.warn({ pattern: pattern.source }, "[Guardrails] medical claim detected");
      return { safe: false, reason: "medical_claim_detected" };
    }
  }

  for (const match of text.matchAll(CALORIE_REGEX)) {
    const value = parseCalorieValue(match[1]);
    if (value > 9000) {
      logger.warn({ value }, "[Guardrails] hallucinated calorie value detected");
      return { safe: false, reason: "calorie_hallucination" };
    }
  }

  if (userProfile && userProfile.allergies.length > 0) {
    const lowerText = text.toLowerCase();
    const allergenMentioned = userProfile.allergies.some((allergen) =>
      lowerText.includes(allergen.toLowerCase()),
    );
    const hasWarning = WARNING_PHRASES.some((phrase) => lowerText.includes(phrase));

    if (allergenMentioned && !hasWarning) {
      logger.info("[Guardrails] allergen mentioned without safety warning — appending note");
      return { safe: true, sanitized: text + ALLERGEN_NOTE };
    }
  }

  return { safe: true, sanitized: text };
}

const FALLBACK_MESSAGE =
  "Desculpe, não consigo fornecer esta resposta pois ela pode conter informações imprecisas ou inadequadas para o seu caso. Para orientações nutricionais personalizadas e seguras, consulte um nutricionista profissional.";

function buildFallbackChunks(): UIChunk[] {
  const id = `guardrail-${Date.now()}`;
  return [
    { type: "text-start", id },
    { type: "text-delta", id, textDelta: FALLBACK_MESSAGE },
    { type: "text-end", id },
    { type: "finish", finishReason: "stop", usage: { inputTokens: 0, outputTokens: 0 } },
  ];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyGuardrails(stream: ReadableStream<any>, userProfile: UserProfile | null): ReadableStream<any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new ReadableStream<any>({
    async start(controller) {
      const reader = (stream as ReadableStream<UIChunk>).getReader();
      const chunks: UIChunk[] = [];

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) chunks.push(value as UIChunk);
        }
      } catch (err) {
        reader.releaseLock();
        logger.error({ err }, "[Guardrails] error buffering stream — using fallback");
        for (const chunk of buildFallbackChunks()) controller.enqueue(chunk);
        controller.close();
        return;
      }
      reader.releaseLock();

      // Extract text from text-delta chunks
      const textContent = chunks
        .filter((c) => c.type === "text-delta" && typeof c.textDelta === "string")
        .map((c) => c.textDelta as string)
        .join("");

      // No text parts — pass through unchanged (e.g. tool-result-only responses)
      if (textContent.length === 0) {
        for (const chunk of chunks) controller.enqueue(chunk);
        controller.close();
        return;
      }

      const result = validateAgentResponse(textContent, userProfile);

      if (!result.safe) {
        logger.warn(
          { reason: result.reason, userId: userProfile?.id },
          "[Guardrails] unsafe response — replacing with fallback",
        );
        for (const chunk of buildFallbackChunks()) controller.enqueue(chunk);
        controller.close();
        return;
      }

      // Re-emit original chunks
      for (const chunk of chunks) controller.enqueue(chunk);

      // Append allergen note if the sanitized text is longer than the original
      if (result.sanitized && result.sanitized.length > textContent.length) {
        const note = result.sanitized.slice(textContent.length);
        const id = `guardrail-note-${Date.now()}`;
        controller.enqueue({ type: "text-start", id });
        controller.enqueue({ type: "text-delta", id, textDelta: note });
        controller.enqueue({ type: "text-end", id });
      }

      controller.close();
    },
  });
}
