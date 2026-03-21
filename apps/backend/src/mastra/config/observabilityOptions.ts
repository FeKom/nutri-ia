import { PinoLogger } from "@mastra/loggers";
import { DefaultExporter, Observability } from "@mastra/observability";

/**
 * Configuração de Observability para DESENVOLVIMENTO
 * - DefaultExporter com strategy 'batch-with-updates' (permite updates em tempo real)
 * - Log level 'debug' para máxima visibilidade
 */
export const devObservabilityConfig = new Observability({
  configs: {
    default: {
      serviceName: 'nutri-ai-dev',
      exporters: [
        // Exportador para console (desenvolvimento)
        new DefaultExporter({
          strategy: 'batch-with-updates', // Permite updates em tempo real
          logger: new PinoLogger({
            name: 'NutriAI-Dev-Observability',
            level: 'debug',
          }),
        }),
      ]
    }
  }
});

/**
 * Configuração de Observability para STAGING/CLOUD
 * - DefaultExporter com strategy 'batch-with-updates' para performance com updates
 * - Adicione aqui exporters para cloud providers (DataDog, NewRelic, etc)
 */
export const stagingObservabilityConfig = new Observability({
  configs: {
    default: {
      serviceName: 'nutri-ai-staging',
      exporters: [
        // Console com batch-with-updates para staging
        new DefaultExporter({
          strategy: 'batch-with-updates',
          logger: new PinoLogger({
            name: 'NutriAI-Staging-Observability',
            level: 'info',
          }),
        }),
        // TODO: Adicione exporters cloud aqui quando necessário
        // Exemplo: new DataDogExporter({ apiKey: process.env.DD_API_KEY })
      ]
    }
  }
});

/**
 * Configuração de Observability para PRODUÇÃO
 * - Múltiplos exporters: console + cloud
 * - Strategy 'insert-only' para máxima performance (sem updates)
 * - Log level 'warn' ou 'error' para reduzir ruído
 */
export const prodObservabilityConfig = new Observability({
  configs: {
    default: {
      serviceName: 'nutri-ai-prod',
      exporters: [
        // Console com insert-only e apenas warnings/errors
        new DefaultExporter({
          strategy: 'insert-only', // Máxima performance - sem updates
          logger: new PinoLogger({
            name: 'NutriAI-Prod-Observability',
            level: 'warn', // Apenas warnings e errors em prod
          }),
        }),
        // TODO: Adicione exporters cloud de produção aqui
        // Exemplo: new DataDogExporter({ apiKey: process.env.DD_API_KEY_PROD })
        // Exemplo: new NewRelicExporter({ licenseKey: process.env.NR_LICENSE_KEY })
      ]
    }
  }
});

/**
 * Helper para selecionar a config baseada no ambiente
 */
export function getObservabilityConfig() {
  const env = process.env.NODE_ENV || 'development';

  switch (env) {
    case 'production':
      return prodObservabilityConfig;
    case 'staging':
      return stagingObservabilityConfig;
    case 'development':
    default:
      return devObservabilityConfig;
  }
}