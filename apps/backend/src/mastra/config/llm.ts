/**
 * Configuração de LLM providers
 * Usando GitHub Models (com token configurado no .env)
 */

/**
 * Retorna a string de modelo configurada para uso com Mastra
 * GitHub Models usa o formato: provider/model-name
 */
export function getLLMModel(): string {
  const model = process.env.MODEL || 'github-models/openai/gpt-4.1-mini';

  if (!process.env.GITHUB_TOKEN) {
    console.warn('⚠️ GITHUB_TOKEN not set. Agent may not work properly.');
  }

  console.log('🔍 Modelo configurado:', model);

  return model;
}

/**
 * Configurações comuns para agents
 */
export const agentDefaults = {
  temperature: 0.7,
  maxTokens: 2000,
};
