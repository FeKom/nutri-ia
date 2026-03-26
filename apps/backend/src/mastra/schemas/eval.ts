import z from "zod";

export const goldenDatasetItemSchema = z.object({
  question: z.string().min(1),
  expected_answer: z.string().min(1),
});

export const overfittingDatasetItemSchema = z.object({
  question: z.string().min(1),
  model_answer: z.string().optional(),
});

export const datasetItemSchema = z.union([
  goldenDatasetItemSchema,
  overfittingDatasetItemSchema,
]);

export const evalQuestionSchema = z.object({
  items: z.array(datasetItemSchema).min(1),
  experiment_id: z.string().uuid(),
});

export const evalExperimentCreateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  prompt: z.string().min(1),
  retrieval_source: z.string().default("json"),
  dataset_filename: z.string().default("golden_dataset.json"),
});

export const evalResultResponseSchema = z.object({
  faithfulness: z.number().optional(),
  answer_relevancy: z.number().optional(),
  context_recall: z.number().optional(),
  context_precision: z.number().optional(),
  overall_score: z.number().optional(),
});

export const evalRunResponseSchema = z.object({
  id: z.string().uuid(),
  question: z.string(),
  expected_answer: z.string().optional(),
  model_answer: z.string().optional(),
  answer: z.string().optional(),
  latency_ms: z.number().int().optional(),
  result: evalResultResponseSchema.optional(),
});

export const evalExperimentResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().optional(),
  params: z.record(z.any()).optional(),
  created_at: z.string(),
  runs: z.array(evalRunResponseSchema).default([]),
  avg_scores: evalResultResponseSchema.optional(),
});

export const evalExperimentSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().optional(),
  params: z.record(z.any()).optional(),
  created_at: z.string(),
  run_count: z.number().int(),
  avg_scores: evalResultResponseSchema.optional(),
});

export const evalListResponseSchema = z.object({
  experiments: z.array(evalExperimentSummarySchema),
  count: z.number().int(),
});
