/**
 * Configuração de variáveis de ambiente para o Mastra Backend
 *
 * Este arquivo centraliza todas as configs de ambiente,
 * facilitando manutenção e evitando process.env espalhados pelo código.
 */

export const env = {
  // ============================================
  // CATALOG API - Food Catalog (FastAPI/Python)
  // ============================================

  /**
   * URL base da API de catálogo de alimentos
   * Default: localhost:8000 (desenvolvimento local)
   */
  CATALOG_API_URL: process.env.CATALOG_API_URL || "http://localhost:8000",

  /**
   * Timeout para requisições à API (em ms)
   * Default: 5 segundos
   */
  CATALOG_API_TIMEOUT: parseInt(process.env.CATALOG_API_TIMEOUT || "5000", 10),

  /**
   * Número de tentativas em caso de falha
   * Default: 3 tentativas
   */
  CATALOG_API_RETRY_ATTEMPTS: parseInt(
    process.env.CATALOG_API_RETRY_ATTEMPTS || "3",
    10,
  ),

  /**
   * Delay entre tentativas (em ms)
   * Default: 1 segundo
   */
  CATALOG_API_RETRY_DELAY: parseInt(
    process.env.CATALOG_API_RETRY_DELAY || "1000",
    10,
  ),

  // ============================================
  // AUTH Configuration
  // ============================================

  /**
   * URL do frontend (Next.js)
   */
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:3000",

  /**
   * URL do backend (Mastra/Hono) onde o Better Auth roda
   * Usado como issuer do JWT e base URL do JWKS
   */
  BACKEND_URL: process.env.BACKEND_URL || "http://localhost:4111",

  /**
   * Connection string do PostgreSQL (usado pelo Better Auth)
   */
  DATABASE_URL: process.env.DATABASE_URL || "",

  /**
   * Secret do Better Auth para assinar sessões
   */
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET || "",

  // ============================================
  // LLM Configuration
  // ============================================

  /**
   * Modelo de LLM a ser usado
   */
  MODEL: process.env.MODEL || "github-models/openai/gpt-4.1-mini",

  /**
   * Token do GitHub para acessar GitHub Models
   */
  GITHUB_TOKEN: process.env.GITHUB_TOKEN,

  // ============================================
  // Environment
  // ============================================

  /**
   * Ambiente atual (development, production, test)
   */
  NODE_ENV: process.env.NODE_ENV || "development",

  /**
   * Se true, loga informações extras de debug
   */
  DEBUG: process.env.DEBUG === "true",
} as const;

/**
 * Valida se as variáveis obrigatórias estão configuradas
 * Chame isso no startup da aplicação
 */
export function validateEnv(): void {
  const warnings: string[] = [];

  if (!env.GITHUB_TOKEN) {
    warnings.push("GITHUB_TOKEN não configurado - Agent pode não funcionar");
  }

  if (env.CATALOG_API_URL === "http://localhost:8000") {
    warnings.push("CATALOG_API_URL usando default (localhost:8000)");
  }

  if (warnings.length > 0) {
    console.warn("⚠️  Avisos de configuração:");
    warnings.forEach((w) => console.warn(`   - ${w}`));
  }

  if (env.DEBUG) {
    console.log("🔧 Configuração carregada:", {
      CATALOG_API_URL: env.CATALOG_API_URL,
      CATALOG_API_TIMEOUT: env.CATALOG_API_TIMEOUT,
      MODEL: env.MODEL,
      NODE_ENV: env.NODE_ENV,
    });
  }
}
