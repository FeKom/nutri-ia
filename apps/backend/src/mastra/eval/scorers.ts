export interface Scores {
  faithfulness: number;
  answer_relevancy: number;
  context_relevancy: number;
  context_recall: number | null;
  context_precision: number | null;
  overall_score: number;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return normA && normB ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
}

async function getEmbeddings(texts: string[], catalogUrl: string): Promise<number[][]> {
  const response = await fetch(`${catalogUrl}/api/v1/eval/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(texts),
  });
  if (!response.ok) throw new Error(`Embed request failed: ${response.status}`);
  return response.json();
}

export async function scoreAll(
  question: string,
  answer: string,
  contextChunks: string[],
  catalogUrl: string,
  expectedAnswer?: string,
): Promise<Scores> {
  const context = contextChunks.join("\n\n");
  const N = contextChunks.length;

  // Build one batch: [question, answer, context, ...chunks, expectedAnswer?]
  const texts = [question, answer, context, ...contextChunks];
  if (expectedAnswer) texts.push(expectedAnswer);

  const embeddings = await getEmbeddings(texts, catalogUrl);

  const qEmb = embeddings[0];
  const aEmb = embeddings[1];
  const cEmb = embeddings[2];
  const chunkEmbs = embeddings.slice(3, 3 + N);
  const eEmb = expectedAnswer ? embeddings[3 + N] : null;

  const answer_relevancy = cosineSimilarity(qEmb, aEmb);
  const faithfulness = cosineSimilarity(aEmb, cEmb);
  const context_relevancy = cosineSimilarity(qEmb, cEmb);

  let context_recall: number | null = null;
  let context_precision: number | null = null;

  if (eEmb) {
    context_recall = cosineSimilarity(eEmb, cEmb);
    context_precision =
      chunkEmbs.length > 0
        ? chunkEmbs.reduce((sum, ce) => sum + cosineSimilarity(qEmb, ce), 0) / chunkEmbs.length
        : 0;
  }

  const overall_score =
    context_recall !== null && context_precision !== null
      ? faithfulness * 0.3 + answer_relevancy * 0.25 + context_relevancy * 0.2 + context_recall * 0.15 + context_precision * 0.1
      : faithfulness * 0.4 + answer_relevancy * 0.35 + context_relevancy * 0.25;

  return { faithfulness, answer_relevancy, context_relevancy, context_recall, context_precision, overall_score };
}
