import { ModelRouterEmbeddingModel } from "@mastra/core/llm";
import { env } from "./env";

export const embedderModel = new ModelRouterEmbeddingModel({
  providerId: "catalog",
  modelId: "intfloat/multilingual-e5-small",
  // ModelRouterEmbeddingModel appends /embeddings to this URL automatically
  url: env.CATALOG_API_URL + "/api/v1/eval",
});
