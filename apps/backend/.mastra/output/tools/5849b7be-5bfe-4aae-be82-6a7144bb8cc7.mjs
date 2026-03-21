import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { a as analyzeImageWithDetic } from '../catalog-client.mjs';
import { e as extractAuthContext, l as logger } from '../logger.mjs';
import '@mastra/core/request-context';
import 'node:async_hooks';
import 'pino';

const analyzeFoodImageDeticToolInput = z.object({
  image_base64: z.string().min(100).describe("Imagem codificada em base64 (com ou sem prefixo data:image)"),
  top_k_per_food: z.number().int().min(1).max(10).default(3).describe("N\xFAmero de matches do cat\xE1logo por alimento detectado"),
  confidence_threshold: z.number().min(0.1).max(1).default(0.5).describe("Threshold m\xEDnimo de confian\xE7a DETIC (0-1)"),
  additional_context: z.string().optional().describe("Contexto adicional do usu\xE1rio")
});
const analyzeFoodImageDeticToolOutput = z.object({
  success: z.boolean().describe("Se a an\xE1lise foi bem-sucedida"),
  detected_foods: z.array(z.string()).describe("Lista de alimentos detectados pelo DETIC"),
  catalog_matches: z.array(
    z.object({
      detected_name: z.string().describe("Nome do alimento detectado"),
      matches: z.array(
        z.object({
          id: z.string().describe("UUID do alimento no cat\xE1logo"),
          name: z.string().describe("Nome do alimento"),
          similarity: z.number().describe("Score de similaridade (0-1)"),
          category: z.string().nullable().describe("Categoria"),
          calories_per_100g: z.number().nullable().describe("Calorias por 100g"),
          serving_size_g: z.number().describe("Tamanho da por\xE7\xE3o em gramas"),
          serving_unit: z.string().describe("Unidade da por\xE7\xE3o"),
          source: z.string().describe("Fonte dos dados"),
          is_verified: z.boolean().describe("Se o alimento \xE9 verificado")
        })
      ).describe("Alimentos do cat\xE1logo que correspondem")
    })
  ).describe("Matches do cat\xE1logo para cada alimento detectado"),
  total_detected: z.number().describe("Total de alimentos \xFAnicos detectados"),
  total_catalog_matches: z.number().describe("Total de matches encontrados no cat\xE1logo"),
  message: z.string().optional().describe("Mensagem opcional (ex: quando nenhum alimento detectado)")
});
const analyzeFoodImageDeticTool = createTool({
  id: "analyze_food_image_detic",
  description: "Analisa imagem de alimento usando DETIC (modelo de vis\xE3o computacional). Identifica alimentos com alta precis\xE3o e busca matches no cat\xE1logo. Use quando tiver acesso \xE0 imagem em base64 e precisar de detec\xE7\xE3o precisa. IMPORTANTE: Este tool REQUER a imagem como par\xE2metro image_base64.",
  inputSchema: analyzeFoodImageDeticToolInput,
  outputSchema: analyzeFoodImageDeticToolOutput,
  execute: async (inputData, executionContext) => {
    const {
      image_base64,
      top_k_per_food = 3,
      confidence_threshold = 0.5,
      additional_context
    } = inputData;
    const { authToken } = extractAuthContext(executionContext);
    logger.info("\u{1F4F8} [Tool:analyzeFoodImageDetic] Analisando imagem com DETIC...");
    logger.info(`   Top-k per food: ${top_k_per_food}`);
    logger.info(`   Confidence threshold: ${confidence_threshold}`);
    if (additional_context) {
      logger.info(`   Contexto adicional: ${additional_context}`);
    }
    try {
      const result = await analyzeImageWithDetic(
        { image: image_base64, top_k_per_food, confidence_threshold },
        void 0,
        authToken
      );
      logger.info(
        `\u2705 [Tool:analyzeFoodImageDetic] An\xE1lise conclu\xEDda: ${result.total_detected} alimento(s) detectado(s), ${result.total_catalog_matches} match(es) no cat\xE1logo`
      );
      if (result.detected_foods && result.detected_foods.length > 0) {
        logger.info(`   Alimentos detectados: ${result.detected_foods.join(", ")}`);
      }
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      logger.error(
        `\u274C [Tool:analyzeFoodImageDetic] Erro ao chamar DETIC: ${errorMessage}`
      );
      return {
        success: false,
        detected_foods: [],
        catalog_matches: [],
        total_detected: 0,
        total_catalog_matches: 0,
        message: `Erro ao analisar imagem: ${errorMessage}. Por favor, tente novamente ou forne\xE7a uma descri\xE7\xE3o manual dos alimentos.`
      };
    }
  }
});

export { analyzeFoodImageDeticTool };
