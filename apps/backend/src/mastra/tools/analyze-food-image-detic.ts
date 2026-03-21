/**
 * Tool para analisar imagens de alimentos usando DETIC (visão computacional)
 *
 * Este tool chama o endpoint /api/v1/foods/analyze do nutria-catalog
 * que usa DETIC (Detecting Twenty-thousand Classes) para detecção real
 * de alimentos em imagens.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { analyzeImageWithDetic } from "../clients/catalog-client";
import { extractAuthContext } from "../utils/auth-context";
import { logger } from "../../utils/logger";

const analyzeFoodImageDeticToolInput = z.object({
  image_base64: z
    .string()
    .min(100)
    .describe("Imagem codificada em base64 (com ou sem prefixo data:image)"),
  top_k_per_food: z
    .number()
    .int()
    .min(1)
    .max(10)
    .default(3)
    .describe("Número de matches do catálogo por alimento detectado"),
  confidence_threshold: z
    .number()
    .min(0.1)
    .max(1.0)
    .default(0.5)
    .describe("Threshold mínimo de confiança DETIC (0-1)"),
  additional_context: z
    .string()
    .optional()
    .describe("Contexto adicional do usuário"),
});

const analyzeFoodImageDeticToolOutput = z.object({
  success: z.boolean().describe("Se a análise foi bem-sucedida"),
  detected_foods: z
    .array(z.string())
    .describe("Lista de alimentos detectados pelo DETIC"),
  catalog_matches: z
    .array(
      z.object({
        detected_name: z.string().describe("Nome do alimento detectado"),
        matches: z
          .array(
            z.object({
              id: z.string().describe("UUID do alimento no catálogo"),
              name: z.string().describe("Nome do alimento"),
              similarity: z.number().describe("Score de similaridade (0-1)"),
              category: z.string().nullable().describe("Categoria"),
              calories_per_100g: z
                .number()
                .nullable()
                .describe("Calorias por 100g"),
              serving_size_g: z.number().describe("Tamanho da porção em gramas"),
              serving_unit: z.string().describe("Unidade da porção"),
              source: z.string().describe("Fonte dos dados"),
              is_verified: z.boolean().describe("Se o alimento é verificado"),
            })
          )
          .describe("Alimentos do catálogo que correspondem"),
      })
    )
    .describe("Matches do catálogo para cada alimento detectado"),
  total_detected: z
    .number()
    .describe("Total de alimentos únicos detectados"),
  total_catalog_matches: z
    .number()
    .describe("Total de matches encontrados no catálogo"),
  message: z
    .string()
    .optional()
    .describe("Mensagem opcional (ex: quando nenhum alimento detectado)"),
});

export const analyzeFoodImageDeticTool = createTool({
  id: "analyze_food_image_detic",
  description:
    "Analisa imagem de alimento usando DETIC (modelo de visão computacional). " +
    "Identifica alimentos com alta precisão e busca matches no catálogo. " +
    "Use quando tiver acesso à imagem em base64 e precisar de detecção precisa. " +
    "IMPORTANTE: Este tool REQUER a imagem como parâmetro image_base64.",
  inputSchema: analyzeFoodImageDeticToolInput,
  outputSchema: analyzeFoodImageDeticToolOutput,
  execute: async (inputData, executionContext) => {
    const {
      image_base64,
      top_k_per_food = 3,
      confidence_threshold = 0.5,
      additional_context,
    } = inputData;

    const { userId, authToken } = extractAuthContext(executionContext);

    logger.info("📸 [Tool:analyzeFoodImageDetic] Analisando imagem com DETIC...");
    logger.info(`   Top-k per food: ${top_k_per_food}`);
    logger.info(`   Confidence threshold: ${confidence_threshold}`);

    if (additional_context) {
      logger.info(`   Contexto adicional: ${additional_context}`);
    }

    try {
      const result = await analyzeImageWithDetic(
        { image: image_base64, top_k_per_food, confidence_threshold },
        undefined,
        authToken,
      );

      logger.info(
        `✅ [Tool:analyzeFoodImageDetic] Análise concluída: ${result.total_detected} alimento(s) detectado(s), ${result.total_catalog_matches} match(es) no catálogo`
      );

      // Log dos alimentos detectados
      if (result.detected_foods && result.detected_foods.length > 0) {
        logger.info(`   Alimentos detectados: ${result.detected_foods.join(", ")}`);
      }

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Erro desconhecido";

      logger.error(
        `❌ [Tool:analyzeFoodImageDetic] Erro ao chamar DETIC: ${errorMessage}`
      );

      // Retorna erro estruturado ao invés de throw
      // para que o agent possa lidar com o erro gracefully
      return {
        success: false,
        detected_foods: [],
        catalog_matches: [],
        total_detected: 0,
        total_catalog_matches: 0,
        message: `Erro ao analisar imagem: ${errorMessage}. Por favor, tente novamente ou forneça uma descrição manual dos alimentos.`,
      };
    }
  },
});
