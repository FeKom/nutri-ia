/**
 * HyDE — Hypothetical Document Embeddings
 *
 * Improves food search recall by generating a hypothetical ideal food
 * description from the user's query, then combining both for embedding lookup.
 *
 * Reference: Gao et al. (2022) "Precise Zero-Shot Dense Retrieval without
 * Relevance Labels"
 */

import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { env } from "./env";

const github = createOpenAI({
  apiKey: process.env.GITHUB_TOKEN || "",
  baseURL: "https://models.inference.ai.azure.com",
});

/**
 * Generates a hypothetical food document that would be the ideal answer
 * for the given query. Falls back to the original query on any error.
 */
export const generateHypotheticalDocument = async (query: string): Promise<string> => {
  try {
    const model = github(env.INTENT_MODEL);
    const { text } = await generateText({
      model,
      prompt:
        `Você é um especialista em nutrição. Descreva em 2-3 frases um alimento que seria a resposta perfeita para: "${query}". Seja específico sobre macronutrientes, categoria e características.`,
      maxTokens: 80,
    });

    return text.trim();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`⚠️ [HyDE] LLM call failed, using original query. Error: ${message}`);
    return query;
  }
};

/**
 * Returns an enriched query string by concatenating the original query with
 * a hypothetically generated food description. The concatenation enriches
 * the embedding signal for pgvector cosine similarity.
 */
export const hydeSearch = async (query: string): Promise<string> => {
  const hypotheticalDoc = await generateHypotheticalDocument(query);
  return `${query} ${hypotheticalDoc}`;
};
