import { createOpenAI } from "@ai-sdk/openai";
import {
  PromptInjectionDetector,
  ModerationProcessor,
  PIIDetector,
} from "@mastra/core/processors";
import type { Processor, ProcessOutputResultArgs } from "@mastra/core/processors";
import type { MastraDBMessage } from "@mastra/core/agent";
import type { UserProfile } from "./memory";
import { logger } from "../../utils/logger";

// Key used to pass userProfile through RequestContext to output processors
export const USER_PROFILE_KEY = "userProfile" as const;

// Shared fast model for all guardrail processors to minimise latency
function createGuardrailModel() {
  const github = createOpenAI({
    apiKey: process.env.GITHUB_TOKEN || "",
    baseURL: "https://models.inference.ai.azure.com",
  });
  return github(process.env.INTENT_MODEL || "Phi-4-mini-instruct");
}

const GUARDRAIL_MODEL = createGuardrailModel();

// Force JSON via prompt injection for models that lack native structured-output support
const STRUCTURED_OUTPUT_OPTIONS = { jsonPromptInjection: true } as const;

// ---------------------------------------------------------------------------
// Input processors
// ---------------------------------------------------------------------------

/**
 * Detects and neutralises prompt-injection / jailbreak attempts.
 * strategy: 'rewrite' preserves any legitimate nutritional question the user had.
 */
export const promptInjectionDetector = new PromptInjectionDetector({
  model: GUARDRAIL_MODEL,
  strategy: "rewrite",
  structuredOutputOptions: STRUCTURED_OUTPUT_OPTIONS,
});

/**
 * Blocks requests for medical diagnoses or otherwise harmful content before
 * the LLM ever sees them.
 */
export const inputModerationProcessor = new ModerationProcessor({
  model: GUARDRAIL_MODEL,
  strategy: "block",
  categories: [
    "medical_diagnosis",
    "harmful_health_advice",
    "violence",
    "hate_speech",
    "sexual_content",
  ],
  structuredOutputOptions: STRUCTURED_OUTPUT_OPTIONS,
});

/**
 * Redacts any PII the user might share (e-mail, CPF, phone, etc.) before
 * it reaches the LLM or is stored in memory.
 */
export const piiDetector = new PIIDetector({
  model: GUARDRAIL_MODEL,
  strategy: "redact",
  structuredOutputOptions: STRUCTURED_OUTPUT_OPTIONS,
});

// ---------------------------------------------------------------------------
// Output processors
// ---------------------------------------------------------------------------

/**
 * Moderates the agent's own responses for harmful or inappropriate content.
 */
export const outputModerationProcessor = new ModerationProcessor({
  model: GUARDRAIL_MODEL,
  strategy: "block",
  structuredOutputOptions: STRUCTURED_OUTPUT_OPTIONS,
});

// ---------------------------------------------------------------------------
// Domain-specific nutritional output guardrail
// ---------------------------------------------------------------------------

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
  return parseFloat(raw.replace(/[.,]/g, ""));
}

/**
 * Domain-specific output processor for nutritional safety:
 *
 * - Blocks responses with medical-diagnosis language
 * - Blocks responses with hallucinated calorie values (>9000 kcal)
 * - Appends an allergen safety note when a user allergen is mentioned
 *   without an accompanying warning phrase
 *
 * The userProfile is read from RequestContext[USER_PROFILE_KEY], set by
 * the route handler before calling agent.stream().
 */
class NutritionalOutputGuardrail implements Processor<"nutritional-output-guardrail"> {
  readonly id = "nutritional-output-guardrail";
  readonly name = "Nutritional Output Guardrail";

  processOutputResult({ messages, abort, requestContext }: ProcessOutputResultArgs): MastraDBMessage[] {
    const userProfile =
      (requestContext?.get(USER_PROFILE_KEY) as UserProfile | undefined) ?? null;

    const lastAssistantIdx = messages.reduce<number>(
      (acc, m, i) => (m.role === "assistant" ? i : acc),
      -1,
    );
    if (lastAssistantIdx === -1) return messages;

    const assistantMsg = messages[lastAssistantIdx];
    const textContent = assistantMsg.content.parts
      .filter((p) => p.type === "text")
      .map((p) => (p as { type: "text"; text: string }).text)
      .join("");

    if (!textContent) return messages;

    // Medical claim check
    for (const pattern of MEDICAL_CLAIM_PATTERNS) {
      if (pattern.test(textContent)) {
        logger.warn({ pattern: pattern.source }, "[Guardrails] medical claim detected");
        abort("medical_claim_detected");
      }
    }

    // Calorie hallucination check
    for (const match of textContent.matchAll(CALORIE_REGEX)) {
      const value = parseCalorieValue(match[1]);
      if (value > 9000) {
        logger.warn({ value }, "[Guardrails] hallucinated calorie value detected");
        abort("calorie_hallucination");
      }
    }

    // Allergen note injection
    if (userProfile && userProfile.allergies.length > 0) {
      const lowerText = textContent.toLowerCase();
      const allergenMentioned = userProfile.allergies.some((a) =>
        lowerText.includes(a.toLowerCase()),
      );
      const hasWarning = WARNING_PHRASES.some((p) => lowerText.includes(p));

      if (allergenMentioned && !hasWarning) {
        logger.info("[Guardrails] allergen mentioned without safety warning — appending note");

        const updatedParts = [...assistantMsg.content.parts];
        const lastTextIdx = updatedParts.reduce<number>(
          (acc, p, i) => (p.type === "text" ? i : acc),
          -1,
        );

        if (lastTextIdx !== -1) {
          const part = updatedParts[lastTextIdx] as { type: "text"; text: string };
          updatedParts[lastTextIdx] = { ...part, text: part.text + ALLERGEN_NOTE };

          return messages.map((m, i) =>
            i === lastAssistantIdx
              ? { ...m, content: { ...m.content, parts: updatedParts } }
              : m,
          );
        }
      }
    }

    return messages;
  }
}

export const nutritionalOutputGuardrail = new NutritionalOutputGuardrail();
