import { Mastra } from '@mastra/core/mastra';
import { registerApiRoute } from '@mastra/core/server';
import { MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY } from '@mastra/core/request-context';
import { toAISdkStream } from '@mastra/ai-sdk';
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import { PinoLogger } from '@mastra/loggers';
import { Agent } from '@mastra/core/agent';
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { createTool } from '@mastra/core/tools';
import z$1, { z } from 'zod';
import { AsyncLocalStorage } from 'node:async_hooks';
import pino from 'pino';
import { ToolSearchProcessor } from '@mastra/core/processors';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { Observability, DefaultExporter } from '@mastra/observability';
import { betterAuth } from 'better-auth';
import { jwt } from 'better-auth/plugins';
import { randomUUID } from 'crypto';
import { Pool } from 'pg';

"use strict";
function findProjectRoot() {
  let currentDir = process.cwd();
  if (currentDir.includes(".mastra/output")) {
    const parts = currentDir.split(".mastra/output");
    return parts[0];
  }
  while (currentDir !== "/") {
    if (existsSync(join(currentDir, "package.json"))) {
      return currentDir;
    }
    currentDir = dirname(currentDir);
  }
  return process.cwd();
}
function loadPrompt(agentName, fileName) {
  try {
    const projectRoot = findProjectRoot();
    const promptPath = join(projectRoot, "src", "mastra", "prompts", agentName, `${fileName}.md`);
    if (!existsSync(promptPath)) {
      throw new Error(`Arquivo n\xE3o encontrado: ${promptPath}`);
    }
    return readFileSync(promptPath, "utf-8");
  } catch (error) {
    console.error(`\u274C Erro ao carregar prompt ${agentName}/${fileName}:`, error);
    throw new Error(`Falha ao carregar prompt: ${agentName}/${fileName}`);
  }
}
function loadPrompts(agentName, fileNames) {
  return fileNames.map((fileName) => loadPrompt(agentName, fileName)).join("\n\n");
}
function loadNutritionAnalystInstructions() {
  const version = process.env.PROMPT_VERSION || "compact";
  if (version === "full") {
    console.log("\u{1F4DD} [Prompts] Usando vers\xE3o FULL (base + tools + examples)");
    return loadPrompts("nutrition-analyst", ["base", "tools", "examples"]);
  }
  console.log("\u{1F4DD} [Prompts] Usando vers\xE3o COMPACT (base-compact)");
  return loadPrompt("nutrition-analyst", "base-compact");
}

"use strict";
const sharedStorage = new LibSQLStore({
  id: "mastra-shared-storage",
  url: process.env.MASTRA_STORAGE_URL || "file:./mastra-data.db"
});

"use strict";
function createNutritionMemory() {
  const storageUrl = process.env.MASTRA_STORAGE_URL || "file:./nutrition-memory.db";
  return new Memory({
    // 📦 Storage: LibSQL para message storage
    storage: sharedStorage,
    // 🔍 Vector store: LibSQL Vector para semantic search (comentado por enquanto)
    // vector: new LibSQLVector({
    //   connectionUrl: vectorUrl,
    // }),
    // 🧮 Embedding: Comentado por enquanto - adicione quando tiver OPENAI_API_KEY
    // embedder: new ModelRouterEmbeddingModel("openai/text-embedding-3-small"),
    options: {
      // 1️⃣ MESSAGE HISTORY: Últimas conversas (reduzido para evitar ultrapassar limite de tokens)
      lastMessages: 5,
      // 2️⃣ SEMANTIC RECALL: Desabilitado (requer embedder)
      // semanticRecall: {
      //   topK: 5,
      //   messageRange: 2,
      //   scope: "resource",
      // },
      // 3️⃣ WORKING MEMORY: Desabilitado - causava loops de updateWorkingMemory
      // O perfil do usuário já é injetado via user-profile-loader como contexto fixo
      workingMemory: {
        enabled: false
      }
    }
    // 4️⃣ GERAÇÃO AUTOMÁTICA DE TÍTULO - Removido temporariamente (API mudou no Mastra 1.3.0)
    // generateTitle: {
    //   model: "github-models/openai/gpt-4o-mini",
    //   instructions: "Gere um título curto (máximo 6 palavras) que resuma o tema principal desta conversa sobre nutrição",
    // },
  });
}
function userProfileToContext(profile) {
  const allergiesText = profile.allergies.length > 0 ? profile.allergies.join(", ") : "Nenhuma alergia registrada";
  const restrictionsText = profile.restrictions.length > 0 ? profile.restrictions.join(", ") : "Nenhuma restri\xE7\xE3o alimentar";
  const dislikesText = profile.dislikes.length > 0 ? profile.dislikes.join(", ") : "Nenhum alimento especificado";
  const goalText = {
    weight_loss: "Perda de peso",
    weight_gain: "Ganho de peso",
    maintain: "Manuten\xE7\xE3o de peso"
  }[profile.goal];
  const activityText = {
    sedentary: "Sedent\xE1rio",
    light: "Levemente ativo",
    moderate: "Moderadamente ativo",
    active: "Ativo",
    very_active: "Muito ativo"
  }[profile.activity_level];
  return {
    role: "system",
    content: `\u{1F4CB} PERFIL OFICIAL DO USU\xC1RIO (fonte: banco de dados)

\u{1F464} Informa\xE7\xF5es Pessoais:
- Nome: ${profile.name}
${profile.age ? `- Idade: ${profile.age} anos` : ""}
${profile.weight ? `- Peso: ${profile.weight} kg` : ""}
${profile.height ? `- Altura: ${profile.height} cm` : ""}
${profile.gender ? `- Sexo: ${profile.gender}` : ""}

\u{1F3AF} Objetivos:
- Objetivo Principal: ${goalText}
- N\xEDvel de Atividade: ${activityText}
${profile.daily_calories_target ? `- Meta Cal\xF3rica Di\xE1ria: ${profile.daily_calories_target} kcal` : ""}
${profile.daily_protein_target ? `- Meta de Prote\xEDna: ${profile.daily_protein_target}g` : ""}
${profile.daily_carbs_target ? `- Meta de Carboidratos: ${profile.daily_carbs_target}g` : ""}
${profile.daily_fat_target ? `- Meta de Gordura: ${profile.daily_fat_target}g` : ""}

\u26A0\uFE0F Restri\xE7\xF5es e Alergias:
- Alergias: ${allergiesText}
- Restri\xE7\xF5es Alimentares: ${restrictionsText}
- Alimentos que n\xE3o gosta: ${dislikesText}

IMPORTANTE: Estas informa\xE7\xF5es s\xE3o oficiais e validadas. Sempre respeite alergias e restri\xE7\xF5es!
`
  };
}

"use strict";
const CATALOG_API_URL = process.env.CATALOG_API_URL || "http://localhost:8000";
const CATALOG_API_TIMEOUT = parseInt(process.env.CATALOG_API_TIMEOUT || "5000");
const PROFILE_CACHE_TTL = 5 * 60 * 1e3;
const profileCache = /* @__PURE__ */ new Map();
function cleanExpiredCache() {
  const now = Date.now();
  for (const [userId, entry] of profileCache.entries()) {
    if (now - entry.timestamp > PROFILE_CACHE_TTL) {
      profileCache.delete(userId);
    }
  }
}
function invalidateUserProfileCache(userId) {
  profileCache.delete(userId);
  console.log(`\u{1F5D1}\uFE0F [Cache] Perfil invalidado para usu\xE1rio: ${userId}`);
}
async function getUserProfileFromDB(userId, forceRefresh = false) {
  if (!userId || userId === "anonymous") {
    console.warn("\u26A0\uFE0F [getUserProfileFromDB] Tentativa de buscar perfil sem user_id v\xE1lido");
    return null;
  }
  cleanExpiredCache();
  if (!forceRefresh) {
    const cached = profileCache.get(userId);
    if (cached) {
      const age = Date.now() - cached.timestamp;
      if (age < PROFILE_CACHE_TTL) {
        console.log(`\u{1F4E6} [Cache HIT] Perfil do usu\xE1rio ${userId} (idade: ${Math.round(age / 1e3)}s)`);
        return cached.profile;
      }
    }
  }
  try {
    console.log(`\u{1F50D} [API] Buscando perfil para usu\xE1rio: ${userId}`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CATALOG_API_TIMEOUT);
    const response = await fetch(`${CATALOG_API_URL}/api/v1/users/profiles/${userId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      if (response.status === 404) {
        console.log(`\u2139\uFE0F [API] Perfil n\xE3o encontrado para usu\xE1rio ${userId}`);
        profileCache.set(userId, { profile: null, timestamp: Date.now() });
        return null;
      }
      const errorText = await response.text();
      console.error(`\u274C [API] Erro (${response.status}):`, errorText);
      return null;
    }
    const data = await response.json();
    console.log(`\u2705 [API] Perfil carregado com sucesso para ${data.name}`);
    const profile = {
      id: data.user_id,
      name: data.name,
      age: data.age,
      weight: data.weight_kg,
      height: data.height_cm,
      gender: data.gender,
      allergies: data.allergies || [],
      restrictions: data.dietary_restrictions || [],
      dislikes: data.disliked_foods || [],
      goal: data.diet_goal || "maintain",
      activity_level: data.activity_level || "moderate",
      daily_calories_target: data.daily_calories_target,
      daily_protein_target: data.daily_protein_target,
      daily_carbs_target: data.daily_carbs_target,
      daily_fat_target: data.daily_fat_target
    };
    profileCache.set(userId, { profile, timestamp: Date.now() });
    return profile;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.error(`\u23F1\uFE0F [API] Timeout ao buscar perfil do usu\xE1rio ${userId}`);
    } else {
      console.error(`\u274C [API] Erro ao buscar perfil:`, error);
    }
    return null;
  }
}
function getCacheStats() {
  return {
    size: profileCache.size,
    entries: Array.from(profileCache.entries()).map(([userId, entry]) => ({
      userId,
      hasProfile: !!entry.profile,
      age: Math.round((Date.now() - entry.timestamp) / 1e3)
    }))
  };
}

"use strict";
const asyncContext = new AsyncLocalStorage();
function getCurrentUserId() {
  return asyncContext.getStore()?.userId || "anonymous";
}
function getCurrentJwtToken() {
  return asyncContext.getStore()?.jwtToken;
}

"use strict";
function extractAuthContext(executionContext) {
  const userId = executionContext?.requestContext?.get(MASTRA_RESOURCE_ID_KEY) || getCurrentUserId();
  const authToken = executionContext?.requestContext?.get("jwt_token") || getCurrentJwtToken();
  return { userId, authToken };
}

"use strict";
const env = {
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
    10
  ),
  /**
   * Delay entre tentativas (em ms)
   * Default: 1 segundo
   */
  CATALOG_API_RETRY_DELAY: parseInt(
    process.env.CATALOG_API_RETRY_DELAY || "1000",
    10
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
  DEBUG: process.env.DEBUG === "true"
};
function validateEnv() {
  const warnings = [];
  if (!env.GITHUB_TOKEN) {
    warnings.push("GITHUB_TOKEN n\xE3o configurado - Agent pode n\xE3o funcionar");
  }
  if (env.CATALOG_API_URL === "http://localhost:8000") {
    warnings.push("CATALOG_API_URL usando default (localhost:8000)");
  }
  if (warnings.length > 0) {
    console.warn("\u26A0\uFE0F  Avisos de configura\xE7\xE3o:");
    warnings.forEach((w) => console.warn(`   - ${w}`));
  }
  if (env.DEBUG) {
    console.log("\u{1F527} Configura\xE7\xE3o carregada:", {
      CATALOG_API_URL: env.CATALOG_API_URL,
      CATALOG_API_TIMEOUT: env.CATALOG_API_TIMEOUT,
      MODEL: env.MODEL,
      NODE_ENV: env.NODE_ENV
    });
  }
}

"use strict";
const createConfig = (overrides) => ({
  baseUrl: env.CATALOG_API_URL,
  timeout: env.CATALOG_API_TIMEOUT,
  maxRetries: env.CATALOG_API_RETRY_ATTEMPTS,
  retryDelay: env.CATALOG_API_RETRY_DELAY,
  ...overrides
});
const defaultConfig = createConfig();
const isRetryableStatus = (status) => [429, 500, 502, 503, 504].includes(status);
const isRetryableError = (error) => {
  if (!(error instanceof Error)) return false;
  const retryablePatterns = [
    "AbortError",
    "TimeoutError",
    "fetch failed",
    "network",
    "ECONNREFUSED"
  ];
  return retryablePatterns.some(
    (pattern) => error.name.includes(pattern) || error.message.includes(pattern)
  );
};
const createApiError = (message, statusCode, isRetryable = false) => ({
  message,
  statusCode,
  isRetryable
});
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const calculateBackoff = (attempt, baseDelay) => baseDelay * Math.pow(2, attempt - 1);
const executeRequest = async (url, options, timeout) => {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers
      },
      signal: AbortSignal.timeout(timeout)
    });
    if (!response.ok) {
      const errorBody = await response.text();
      return {
        success: false,
        error: createApiError(
          `API retornou status ${response.status}: ${errorBody}`,
          response.status,
          isRetryableStatus(response.status)
        )
      };
    }
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: createApiError(
        error instanceof Error ? error.message : "Erro desconhecido",
        void 0,
        isRetryableError(error)
      )
    };
  }
};
const executeWithRetry = async (url, options, config, attempt = 1) => {
  const result = await executeRequest(url, options, config.timeout);
  if (result.success) {
    return result.data;
  }
  const { error } = result;
  const isLastAttempt = attempt >= config.maxRetries;
  console.warn(
    `\u26A0\uFE0F [CatalogClient] Tentativa ${attempt}/${config.maxRetries} falhou:`,
    error.message
  );
  if (isLastAttempt || !error.isRetryable) {
    throw new Error(
      `Falha ao conectar com Catalog API ap\xF3s ${attempt} tentativa(s): ${error.message}`
    );
  }
  const delay = calculateBackoff(attempt, config.retryDelay);
  console.log(`\u23F3 [CatalogClient] Aguardando ${delay}ms antes de retry...`);
  await sleep(delay);
  return executeWithRetry(url, options, config, attempt + 1);
};
const postRequest = (endpoint, body, config, authToken) => {
  const url = `${config.baseUrl}${endpoint}`;
  const headers = {};
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }
  return executeWithRetry(
    url,
    {
      method: "POST",
      body: JSON.stringify(body),
      headers
    },
    config
  );
};
const searchFoods = async (request, config = defaultConfig, authToken) => {
  console.log(`\u{1F50D} [CatalogClient] Buscando alimentos: "${request.query}"`);
  const response = await postRequest(
    "/api/v1/foods/search",
    {
      query: request.query,
      limit: request.limit ?? 10,
      filters: request.filters ?? {}
    },
    config,
    authToken
  );
  console.log(`\u2705 [CatalogClient] Encontrados ${response.count} alimentos`);
  return response;
};
const searchFoodsByEmbedding = async (request, config = defaultConfig, authToken) => {
  console.log(`\u{1F9E0} [CatalogClient] Busca sem\xE2ntica: "${request.query}"`);
  const response = await postRequest(
    "/api/v1/foods/search-by-embedding",
    {
      query: request.query,
      limit: request.limit ?? 10,
      filters: request.filters ?? {}
    },
    config,
    authToken
  );
  console.log(
    `\u2705 [CatalogClient] Encontrados ${response.count} alimentos similares`
  );
  return response;
};
const calculateNutrition = async (foods, config = defaultConfig, authToken) => {
  console.log(
    `\u{1F9EE} [CatalogClient] Calculando nutri\xE7\xE3o para ${foods.length} alimentos`
  );
  const response = await postRequest(
    "/api/v1/nutrition/calculate",
    { foods },
    config,
    authToken
  );
  console.log(
    `\u2705 [CatalogClient] Total calculado: ${response.total.calories} kcal`
  );
  return response;
};
const findSimilarFoods = async (request, config = defaultConfig, authToken) => {
  console.log(
    `\u{1F504} [CatalogClient] Buscando alimentos similares para: "${request.food_id}"`
  );
  const response = await postRequest(
    "/api/v1/foods/similar",
    {
      food_id: request.food_id,
      limit: request.limit ?? 10,
      same_category: request.same_category ?? false,
      tolerance: request.tolerance ?? 0.3
    },
    config,
    authToken
  );
  console.log(
    `\u2705 [CatalogClient] Encontrados ${response.count} alimentos similares`
  );
  return response;
};
const getRecommendations = async (request, config = defaultConfig, authToken) => {
  console.log(
    `\u{1F3AF} [CatalogClient] Buscando recomenda\xE7\xF5es para usu\xE1rio: "${request.user_id}"`
  );
  const response = await postRequest(
    "/api/v1/recommendations",
    {
      user_id: request.user_id,
      limit: request.limit ?? 50,
      ...request.category && { category: request.category }
    },
    config,
    authToken
  );
  console.log(`\u2705 [CatalogClient] Encontradas ${response.count} recomenda\xE7\xF5es`);
  return response;
};
const logMeal = async (request, config = defaultConfig, authToken) => {
  console.log(
    `\u{1F4CA} [CatalogClient] Registrando ${request.meal_type} com ${request.foods.length} alimentos`
  );
  const response = await postRequest(
    "/api/v1/tracking/meals/log",
    request,
    config,
    authToken
  );
  console.log(
    `\u2705 [CatalogClient] Refei\xE7\xE3o registrada: ${response.total_calories} kcal`
  );
  return response;
};
const getDailySummary = async (userId, date, config = defaultConfig, authToken) => {
  console.log(`\u{1F4C8} [CatalogClient] Obtendo resumo di\xE1rio para ${userId}`);
  const params = new URLSearchParams({
    ...date && { target_date: date }
  });
  const url = `${config.baseUrl}/api/v1/tracking/summary/daily?${params}`;
  const headers = {};
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
  const result = await executeRequest(
    url,
    { method: "GET", headers },
    config.timeout
  );
  if (!result.success) {
    throw new Error(result.error.message);
  }
  console.log(
    `\u2705 [CatalogClient] Resumo obtido: ${result.data.num_meals} refei\xE7\xF5es`
  );
  return result.data;
};
const getWeeklyStats = async (userId, days = 7, config = defaultConfig, authToken) => {
  console.log(
    `\u{1F4CA} [CatalogClient] Obtendo estat\xEDsticas de ${days} dias para ${userId}`
  );
  const params = new URLSearchParams({
    days: days.toString()
  });
  const url = `${config.baseUrl}/api/v1/tracking/stats/weekly?${params}`;
  const headers = {};
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
  const result = await executeRequest(
    url,
    { method: "GET", headers },
    config.timeout
  );
  if (!result.success) {
    throw new Error(result.error.message);
  }
  console.log(
    `\u2705 [CatalogClient] Estat\xEDsticas obtidas: ${result.data.stats.length} dias`
  );
  return result.data;
};
const createMealPlan = async (request, config = defaultConfig, authToken) => {
  console.log(
    `\u{1F4CB} [CatalogClient] Criando plano alimentar: "${request.plan_name}"`
  );
  const response = await postRequest(
    `/api/v1/meal-plans`,
    request,
    config,
    authToken
  );
  console.log(`\u2705 [CatalogClient] Plano criado: ${response.id}`);
  return response;
};
const listMealPlans = async (userId, page = 1, pageSize = 10, config = defaultConfig, authToken) => {
  console.log(
    `\u{1F4CB} [CatalogClient] Listando planos alimentares para usu\xE1rio: ${userId}`
  );
  const params = new URLSearchParams({
    page: page.toString(),
    page_size: pageSize.toString()
  });
  const url = `${config.baseUrl}/api/v1/meal-plans?${params}`;
  const headers = {};
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
  const result = await executeRequest(
    url,
    { method: "GET", headers },
    config.timeout
  );
  if (!result.success) {
    throw new Error(result.error.message);
  }
  console.log(
    `\u2705 [CatalogClient] Encontrados ${result.data.total} planos alimentares`
  );
  return result.data;
};
const getMealPlan = async (planId, userId, config = defaultConfig, authToken) => {
  console.log(`\u{1F4CB} [CatalogClient] Obtendo plano alimentar: ${planId}`);
  const url = `${config.baseUrl}/api/v1/meal-plans/${planId}`;
  const headers = {};
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
  const result = await executeRequest(
    url,
    { method: "GET", headers },
    config.timeout
  );
  if (!result.success) {
    throw new Error(result.error.message);
  }
  console.log(`\u2705 [CatalogClient] Plano obtido: "${result.data.plan_name}"`);
  return result.data;
};
const updateMealPlan = async (planId, userId, updates, config = defaultConfig, authToken) => {
  console.log(`\u{1F4CB} [CatalogClient] Atualizando plano alimentar: ${planId}`);
  const url = `${config.baseUrl}/api/v1/meal-plans/${planId}`;
  const headers = {
    "Content-Type": "application/json"
  };
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
  const result = await executeRequest(
    url,
    {
      method: "PUT",
      body: JSON.stringify(updates),
      headers
    },
    config.timeout
  );
  if (!result.success) {
    throw new Error(result.error.message);
  }
  console.log(`\u2705 [CatalogClient] Plano atualizado`);
  return result.data;
};
const deleteMealPlan = async (planId, userId, config = defaultConfig, authToken) => {
  console.log(`\u{1F4CB} [CatalogClient] Deletando plano alimentar: ${planId}`);
  const url = `${config.baseUrl}/api/v1/meal-plans/${planId}`;
  const headers = {};
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
  const result = await executeRequest(
    url,
    { method: "DELETE", headers },
    config.timeout
  );
  if (!result.success) {
    throw new Error(result.error.message);
  }
  console.log(`\u2705 [CatalogClient] Plano deletado`);
};
const createUserProfile = async (request, config = defaultConfig, authToken) => {
  console.log(
    `\u{1F464} [CatalogClient] Criando perfil para usu\xE1rio: ${request.user_id}`
  );
  const response = await postRequest(
    "/api/v1/users/profiles",
    request,
    config,
    authToken
  );
  console.log(`\u2705 [CatalogClient] Perfil criado: ${response.user_id}`);
  return response;
};
const updateUserProfile = async (request, config = defaultConfig, authToken) => {
  console.log(`\u270F\uFE0F [CatalogClient] Atualizando perfil do usu\xE1rio`);
  const url = `${config.baseUrl}/api/v1/users/profiles/me`;
  const headers = { "Content-Type": "application/json" };
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
  const result = await executeRequest(
    url,
    { method: "PUT", body: JSON.stringify(request), headers },
    config.timeout
  );
  if (!result.success) {
    throw new Error(result.error.message);
  }
  console.log(`\u2705 [CatalogClient] Perfil atualizado`);
  return result.data;
};
const analyzeImageWithDetic = async (request, config = defaultConfig, authToken) => {
  console.log(`\u{1F4F8} [CatalogClient] Analisando imagem com DETIC`);
  const response = await postRequest(
    "/api/v1/foods/analyze",
    request,
    config,
    authToken
  );
  console.log(
    `\u2705 [CatalogClient] DETIC: ${response.total_detected} alimento(s) detectado(s)`
  );
  return response;
};
const healthCheck = async (config = defaultConfig) => {
  try {
    const response = await fetch(`${config.baseUrl}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(config.timeout)
    });
    return response.ok;
  } catch {
    return false;
  }
};
const createClient = (customConfig) => {
  const config = createConfig(customConfig);
  return {
    searchFoods: (request) => searchFoods(request, config),
    searchFoodsByEmbedding: (request) => searchFoodsByEmbedding(request, config),
    calculateNutrition: (foods) => calculateNutrition(foods, config),
    findSimilarFoods: (request) => findSimilarFoods(request, config),
    getRecommendations: (request) => getRecommendations(request, config),
    logMeal: (request) => logMeal(request, config),
    getDailySummary: (userId, date) => getDailySummary(userId, date, config),
    getWeeklyStats: (userId, days) => getWeeklyStats(userId, days, config),
    createMealPlan: (request) => createMealPlan(request, config),
    listMealPlans: (userId, page, pageSize) => listMealPlans(userId, page, pageSize, config),
    getMealPlan: (planId, userId) => getMealPlan(planId, userId, config),
    updateMealPlan: (planId, userId, updates) => updateMealPlan(planId, userId, updates, config),
    deleteMealPlan: (planId, userId) => deleteMealPlan(planId, userId, config),
    healthCheck: () => healthCheck(config),
    config
  };
};

"use strict";
const logger = pino({
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "dd/mm/yyyy HH:MM:ss",
      ignore: "pid,hostname"
    }
  }
});

"use strict";
const createUserProfileToolInput = z.object({
  name: z.string().describe("Nome do usu\xE1rio"),
  age: z.number().int().min(1).max(120).describe("Idade do usu\xE1rio"),
  weight_kg: z.number().positive().describe("Peso em kg"),
  height_cm: z.number().positive().describe("Altura em cm"),
  gender: z.enum(["male", "female", "non_binary"]).describe(
    "G\xEAnero (male, female ou non_binary) - usado para c\xE1lculos nutricionais"
  ),
  activity_level: z.enum(["sedentary", "light", "moderate", "active", "very_active"]).optional().describe("N\xEDvel de atividade f\xEDsica"),
  diet_goal: z.enum(["weight_loss", "weight_gain", "maintain"]).optional().describe("Objetivo alimentar"),
  dietary_restrictions: z.array(z.string()).optional().describe(
    'Restri\xE7\xF5es alimentares (ex: ["vegetarian", "vegan", "gluten-free"])'
  ),
  allergies: z.array(z.string()).optional().describe('Alergias alimentares (ex: ["peanuts", "shellfish", "lactose"])'),
  disliked_foods: z.array(z.string()).optional().describe('Alimentos que n\xE3o gosta (ex: ["broccoli", "liver"])'),
  preferred_cuisines: z.array(z.string()).optional().describe(
    'Culin\xE1rias preferidas (ex: ["brazilian", "italian", "japanese"])'
  )
});
const createUserProfileTool = createTool({
  id: "create_user_profile",
  description: "Cria um novo perfil nutricional para o usu\xE1rio com suas informa\xE7\xF5es pessoais, prefer\xEAncias e restri\xE7\xF5es. Use esta tool ap\xF3s coletar as informa\xE7\xF5es do usu\xE1rio atrav\xE9s de perguntas. O perfil ser\xE1 usado para personalizar recomenda\xE7\xF5es de alimentos e acompanhar o progresso nutricional. Exemplos de quando usar: 'Quero criar meu perfil', 'Preciso configurar minhas restri\xE7\xF5es alimentares', 'Quero personalizar minhas recomenda\xE7\xF5es'",
  inputSchema: createUserProfileToolInput,
  outputSchema: z.object({
    success: z.boolean().describe("Se o perfil foi criado com sucesso"),
    user_id: z.string().optional().describe("ID do usu\xE1rio criado"),
    message: z.string().describe("Mensagem de sucesso ou erro"),
    profile: z.object({
      name: z.string(),
      age: z.number(),
      weight_kg: z.number().optional(),
      height_cm: z.number().optional(),
      gender: z.string().optional(),
      activity_level: z.string().optional(),
      diet_goal: z.string().optional(),
      dietary_restrictions: z.array(z.string()),
      allergies: z.array(z.string()),
      disliked_foods: z.array(z.string())
    }).optional().describe("Dados do perfil criado")
  }),
  execute: async (inputData, executionContext) => {
    const {
      name,
      age,
      weight_kg,
      height_cm,
      gender,
      activity_level,
      diet_goal,
      dietary_restrictions = [],
      allergies = [],
      disliked_foods = [],
      preferred_cuisines = []
    } = inputData;
    const { userId, authToken } = extractAuthContext(executionContext);
    if (!userId || userId === "anonymous") {
      return {
        success: false,
        message: "N\xE3o foi poss\xEDvel criar o perfil: usu\xE1rio n\xE3o autenticado. Por favor, fa\xE7a login primeiro."
      };
    }
    logger.info(`\u{1F464} [Tool:createUserProfile] Criando perfil para usu\xE1rio: ${userId}`);
    const existingProfile = await getUserProfileFromDB(userId);
    if (existingProfile) {
      logger.info(
        `\u26A0\uFE0F [Tool:createUserProfile] Perfil j\xE1 existe para ${userId}`
      );
      return {
        success: true,
        user_id: userId,
        message: "O usu\xE1rio j\xE1 possui um perfil cadastrado. Use os dados existentes ou sugira atualizar o perfil.",
        profile: {
          name: existingProfile.name,
          age: existingProfile.age ?? 0,
          weight_kg: existingProfile.weight ?? void 0,
          height_cm: existingProfile.height ?? void 0,
          gender: existingProfile.gender,
          activity_level: existingProfile.activity_level,
          diet_goal: existingProfile.goal,
          dietary_restrictions: existingProfile.restrictions,
          allergies: existingProfile.allergies,
          disliked_foods: existingProfile.dislikes
        }
      };
    }
    try {
      const profileData = await createUserProfile(
        {
          user_id: userId,
          name,
          age,
          weight_kg,
          height_cm,
          gender,
          activity_level: activity_level || "moderate",
          diet_goal: diet_goal || "maintain",
          dietary_restrictions,
          allergies,
          disliked_foods,
          preferred_cuisines
        },
        defaultConfig,
        authToken
      );
      logger.info("\u2705 [Tool:createUserProfile] Perfil criado com sucesso!");
      invalidateUserProfileCache(userId);
      return {
        success: true,
        user_id: userId,
        message: `Perfil criado com sucesso! Agora posso fornecer recomenda\xE7\xF5es personalizadas baseadas em suas prefer\xEAncias e restri\xE7\xF5es.`,
        profile: {
          name: profileData.name,
          age: profileData.age,
          weight_kg: profileData.weight_kg ?? void 0,
          height_cm: profileData.height_cm ?? void 0,
          gender: profileData.gender,
          activity_level: profileData.activity_level,
          diet_goal: profileData.diet_goal,
          dietary_restrictions: profileData.dietary_restrictions || [],
          allergies: profileData.allergies || [],
          disliked_foods: profileData.disliked_foods || []
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      logger.error(`\u274C [Tool:createUserProfile] Erro: ${error instanceof Error ? error.message : error}`);
      return {
        success: false,
        message: `Erro ao criar perfil: ${errorMessage}`
      };
    }
  }
});

"use strict";
const updateUserProfileToolInput = z.object({
  weight_kg: z.number().positive().optional().describe("Novo peso em kg"),
  height_cm: z.number().positive().optional().describe("Nova altura em cm"),
  age: z.number().int().min(1).max(120).optional().describe("Nova idade"),
  gender: z.enum(["male", "female", "non_binary"]).optional().describe("G\xEAnero (male, female ou non_binary)"),
  activity_level: z.enum(["sedentary", "light", "moderate", "active", "very_active"]).optional().describe("N\xEDvel de atividade f\xEDsica"),
  diet_goal: z.enum(["weight_loss", "weight_gain", "maintain"]).optional().describe("Objetivo alimentar"),
  dietary_restrictions: z.array(z.string()).optional().describe("Restri\xE7\xF5es alimentares"),
  allergies: z.array(z.string()).optional().describe("Alergias alimentares"),
  disliked_foods: z.array(z.string()).optional().describe("Alimentos que n\xE3o gosta")
});
const updateUserProfileTool = createTool({
  id: "update_user_profile",
  description: "Atualiza o perfil do usu\xE1rio com novos dados. Use quando o usu\xE1rio quiser alterar informa\xE7\xF5es como peso, altura, objetivo ou restri\xE7\xF5es. Apenas os campos fornecidos ser\xE3o atualizados \u2014 os demais permanecem inalterados.",
  inputSchema: updateUserProfileToolInput,
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    profile: z.object({
      weight_kg: z.number().optional(),
      height_cm: z.number().optional(),
      age: z.number().optional(),
      gender: z.string().optional(),
      activity_level: z.string().optional(),
      diet_goal: z.string().optional()
    }).optional()
  }),
  execute: async (inputData, executionContext) => {
    const { userId, authToken } = extractAuthContext(executionContext);
    if (!userId || userId === "anonymous") {
      return {
        success: false,
        message: "Usu\xE1rio n\xE3o autenticado. Fa\xE7a login primeiro."
      };
    }
    logger.info(
      `\u270F\uFE0F [Tool:updateUserProfile] Atualizando perfil para usu\xE1rio: ${userId}`
    );
    try {
      const profileData = await updateUserProfile(
        inputData,
        defaultConfig,
        authToken
      );
      invalidateUserProfileCache(userId);
      logger.info("\u2705 [Tool:updateUserProfile] Perfil atualizado com sucesso!");
      return {
        success: true,
        message: "Perfil atualizado com sucesso!",
        profile: {
          weight_kg: profileData.weight_kg ?? void 0,
          height_cm: profileData.height_cm ?? void 0,
          age: profileData.age,
          gender: profileData.gender,
          activity_level: profileData.activity_level,
          diet_goal: profileData.diet_goal
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      logger.error(`\u274C [Tool:updateUserProfile] Erro: ${error instanceof Error ? error.message : error}`);
      return {
        success: false,
        message: `Erro ao atualizar perfil: ${errorMessage}`
      };
    }
  }
});

"use strict";
const calculateMacrosToolInput = z.object({
  override_weight_kg: z.number().positive().optional().describe("Peso em kg (opcional, usa do perfil se n\xE3o fornecido)"),
  override_height_cm: z.number().positive().optional().describe("Altura em cm (opcional, usa do perfil se n\xE3o fornecido)"),
  override_age: z.number().int().positive().optional().describe("Idade (opcional, usa do perfil se n\xE3o fornecido)"),
  override_gender: z.enum(["male", "female", "non_binary"]).optional().describe("G\xEAnero (opcional, usa do perfil se n\xE3o fornecido)"),
  override_activity_level: z.enum(["sedentary", "light", "moderate", "active", "very_active"]).optional().describe("N\xEDvel de atividade (opcional, usa do perfil se n\xE3o fornecido)"),
  override_diet_goal: z.enum(["weight_loss", "weight_gain", "maintain"]).optional().describe("Objetivo (opcional, usa do perfil se n\xE3o fornecido)")
});
const calculateMacrosToolOutput = z.object({
  success: z.boolean().describe("Se o c\xE1lculo foi bem-sucedido"),
  tmb: z.number().describe("Taxa Metab\xF3lica Basal (kcal/dia)"),
  tdee: z.number().describe("Gasto Energ\xE9tico Di\xE1rio Total (kcal/dia)"),
  daily_calories: z.number().describe("Calorias di\xE1rias recomendadas"),
  daily_protein_g: z.number().describe("Prote\xEDna di\xE1ria em gramas"),
  daily_carbs_g: z.number().describe("Carboidratos di\xE1rios em gramas"),
  daily_fat_g: z.number().describe("Gordura di\xE1ria em gramas"),
  calorie_adjustment: z.number().describe("Ajuste cal\xF3rico aplicado (d\xE9ficit/super\xE1vit)"),
  diet_goal: z.string().describe("Objetivo do plano"),
  profile_used: z.object({
    weight_kg: z.number(),
    height_cm: z.number(),
    age: z.number(),
    gender: z.string(),
    activity_level: z.string(),
    diet_goal: z.string()
  }).describe("Perfil usado para o c\xE1lculo"),
  explanation: z.string().describe("Explica\xE7\xE3o do c\xE1lculo em portugu\xEAs")
});
function calculateTMB(weight_kg, height_cm, age, gender) {
  const base = 10 * weight_kg + 6.25 * height_cm - 5 * age;
  const genderAdjustment = gender === "male" ? 5 : gender === "non_binary" ? -78 : -161;
  return Math.round(base + genderAdjustment);
}
function getActivityFactor(activity_level) {
  const factors = {
    sedentary: 1.2,
    // Pouco ou nenhum exercício
    light: 1.375,
    // Exercício leve 1-3 dias/semana
    moderate: 1.55,
    // Exercício moderado 3-5 dias/semana
    active: 1.725,
    // Exercício intenso 6-7 dias/semana
    very_active: 1.9
    // Exercício muito intenso, trabalho físico
  };
  return factors[activity_level] || 1.2;
}
function getCalorieAdjustment(diet_goal) {
  const adjustments = {
    weight_loss: -500,
    // Déficit de 500 kcal/dia = ~0.5kg/semana
    weight_gain: 500,
    // Superávit de 500 kcal/dia = ~0.5kg/semana
    maintain: 0
    // Manutenção
  };
  return adjustments[diet_goal] || 0;
}
function calculateMacros(daily_calories, weight_kg, diet_goal) {
  let protein_g_per_kg = 1.6;
  if (diet_goal === "weight_loss") {
    protein_g_per_kg = 2;
  } else if (diet_goal === "weight_gain") {
    protein_g_per_kg = 2.2;
  }
  const protein_g = Math.round(weight_kg * protein_g_per_kg);
  const protein_calories = protein_g * 4;
  const fat_percentage = 0.28;
  const fat_calories = daily_calories * fat_percentage;
  const fat_g = Math.round(fat_calories / 9);
  const carbs_calories = daily_calories - protein_calories - fat_calories;
  const carbs_g = Math.round(carbs_calories / 4);
  return { protein_g, carbs_g, fat_g };
}
const calculateMacrosTool = createTool({
  id: "calculate_macros",
  description: "Utilize est\xE1 tool quando o usu\xE1rio perguntar quantas calorias ele ter\xE1 que consumirN\xE3o utilize essa tool para calcular os alimentos, para calcular alimentos utilize calculate-nutritionCalcula metas nutricionais (calorias e macros) baseado no perfil do usu\xE1rio. Usa f\xF3rmula de Mifflin-St Jeor para TMB e distribui macros otimizados por objetivo. Use quando precisar calcular quantidades para um plano alimentar ou quando o usu\xE1rio perguntar quantas calorias/prote\xEDnas deve consumir. Pode sobrescrever valores do perfil se necess\xE1rio.",
  inputSchema: calculateMacrosToolInput,
  outputSchema: calculateMacrosToolOutput,
  execute: async (inputData, executionContext) => {
    const {
      override_weight_kg,
      override_height_cm,
      override_age,
      override_gender,
      override_activity_level,
      override_diet_goal
    } = inputData;
    const { userId } = extractAuthContext(executionContext);
    logger.info(
      `\u{1F9EE} [Tool:calculateMacros] Calculando macros para usu\xE1rio: ${userId}`
    );
    try {
      let profile = null;
      let weight_kg = override_weight_kg;
      let height_cm = override_height_cm;
      let age = override_age;
      let gender = override_gender;
      let activity_level = override_activity_level;
      let diet_goal = override_diet_goal;
      if (!weight_kg || !height_cm || !age || !gender || !activity_level || !diet_goal) {
        if (userId === "anonymous") {
          throw new Error(
            "Dados insuficientes para calcular macros. Forne\xE7a peso, altura, idade, g\xEAnero, n\xEDvel de atividade e objetivo, ou crie um perfil."
          );
        }
        profile = await getUserProfileFromDB(userId);
        if (!profile) {
          throw new Error(
            "Perfil n\xE3o encontrado. Crie um perfil primeiro ou forne\xE7a todos os dados necess\xE1rios."
          );
        }
        weight_kg = weight_kg || profile.weight;
        height_cm = height_cm || profile.height;
        age = age || profile.age;
        gender = gender || profile.gender?.toLowerCase();
        activity_level = activity_level || profile.activity_level;
        diet_goal = diet_goal || profile.goal;
      }
      if (!weight_kg || !height_cm || !age || !gender || !activity_level || !diet_goal) {
        const missingFields = [];
        if (!weight_kg) missingFields.push("peso (override_weight_kg)");
        if (!height_cm) missingFields.push("altura (override_height_cm)");
        if (!age) missingFields.push("idade (override_age)");
        if (!gender) missingFields.push("g\xEAnero (override_gender)");
        if (!activity_level) missingFields.push("n\xEDvel de atividade (override_activity_level)");
        if (!diet_goal) missingFields.push("objetivo (override_diet_goal)");
        throw new Error(
          `Dados incompletos para calcular macros. Campos faltando: ${missingFields.join(", ")}. Pe\xE7a ao usu\xE1rio esses dados e chame a tool novamente usando os par\xE2metros override_* correspondentes.`
        );
      }
      if (!["male", "female", "non_binary"].includes(gender)) {
        if (gender.includes("masc") || gender.includes("homem")) {
          gender = "male";
        } else if (gender.includes("fem") || gender.includes("mulher")) {
          gender = "female";
        } else if (gender.includes("nb") || gender.includes("n\xE3o bin\xE1r") || gender.includes("nao binar") || gender.includes("non")) {
          gender = "non_binary";
        } else {
          throw new Error(
            `G\xEAnero inv\xE1lido: ${gender}. Use 'male', 'female' ou 'non_binary'.`
          );
        }
      }
      logger.info(
        `   Perfil: ${weight_kg}kg, ${height_cm}cm, ${age} anos, ${gender}`
      );
      logger.info(`   Atividade: ${activity_level}, Objetivo: ${diet_goal}`);
      const tmb = calculateTMB(weight_kg, height_cm, age, gender);
      logger.info(`   TMB: ${tmb} kcal/dia`);
      const activityFactor = getActivityFactor(activity_level);
      const tdee = Math.round(tmb * activityFactor);
      logger.info(`   TDEE: ${tdee} kcal/dia (fator ${activityFactor})`);
      const calorieAdjustment = getCalorieAdjustment(diet_goal);
      const daily_calories = tdee + calorieAdjustment;
      logger.info(
        `   Calorias ajustadas: ${daily_calories} kcal/dia (${calorieAdjustment >= 0 ? "+" : ""}${calorieAdjustment})`
      );
      const macros = calculateMacros(daily_calories, weight_kg, diet_goal);
      logger.info(
        `   Macros: ${macros.protein_g}g prote\xEDna, ${macros.carbs_g}g carbos, ${macros.fat_g}g gordura`
      );
      const goalNames = {
        weight_loss: "perda de peso",
        weight_gain: "ganho de peso",
        maintain: "manuten\xE7\xE3o"
      };
      const activityNames = {
        sedentary: "sedent\xE1rio",
        light: "levemente ativo",
        moderate: "moderadamente ativo",
        active: "muito ativo",
        very_active: "extremamente ativo"
      };
      const explanation = `
Baseado no seu perfil (${weight_kg}kg, ${height_cm}cm, ${age} anos, ${gender === "male" ? "masculino" : gender === "non_binary" ? "n\xE3o bin\xE1rio" : "feminino"}):

\u{1F4CA} **C\xE1lculos Nutricionais**
\u2022 TMB (metabolismo basal): ${tmb} kcal/dia
\u2022 TDEE (gasto total com atividade ${activityNames[activity_level]}): ${tdee} kcal/dia
\u2022 Meta ajustada para ${goalNames[diet_goal]}: ${daily_calories} kcal/dia

\u{1F37D}\uFE0F **Distribui\xE7\xE3o de Macros**
\u2022 Prote\xEDna: ${macros.protein_g}g/dia (${(macros.protein_g / weight_kg).toFixed(1)}g/kg)
\u2022 Carboidratos: ${macros.carbs_g}g/dia
\u2022 Gordura: ${macros.fat_g}g/dia

\u{1F4A1} **Nota**: Estes valores s\xE3o estimativas. Ajuste conforme necess\xE1rio baseado nos resultados.
`.trim();
      logger.info(`\u2705 [Tool:calculateMacros] C\xE1lculo conclu\xEDdo com sucesso`);
      return {
        success: true,
        tmb,
        tdee,
        daily_calories,
        daily_protein_g: macros.protein_g,
        daily_carbs_g: macros.carbs_g,
        daily_fat_g: macros.fat_g,
        calorie_adjustment: calorieAdjustment,
        diet_goal,
        profile_used: {
          weight_kg,
          height_cm,
          age,
          gender,
          activity_level,
          diet_goal
        },
        explanation
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      logger.error(`\u274C [Tool:calculateMacros] Erro: ${errorMessage}`);
      throw new Error(`Erro ao calcular macros: ${errorMessage}`);
    }
  }
});

"use strict";
const createMealPlanToolInput = z.object({
  plan_name: z.string().min(1).max(100).describe("Nome do plano alimentar"),
  description: z.string().max(500).optional().describe("Descri\xE7\xE3o do plano alimentar"),
  daily_calories: z.number().positive().describe("Meta di\xE1ria de calorias"),
  daily_protein_g: z.number().positive().describe("Meta di\xE1ria de prote\xEDna em gramas"),
  daily_fat_g: z.number().positive().describe("Meta di\xE1ria de gordura em gramas"),
  daily_carbs_g: z.number().positive().describe("Meta di\xE1ria de carboidratos em gramas"),
  meals: z.array(z.record(z.unknown())).optional().describe("Lista de refei\xE7\xF5es do plano (opcional)")
});
const createMealPlanToolOutput = z.object({
  id: z.string().describe("ID do plano criado"),
  plan_name: z.string().describe("Nome do plano"),
  daily_calories: z.number().describe("Calorias di\xE1rias"),
  created_by: z.string().describe("Criado por (user ou ai)"),
  message: z.string().describe("Mensagem de sucesso")
});
const createMealPlanTool = createTool({
  id: "create_meal_plan",
  description: "Cria um novo plano alimentar (dieta) personalizado para o usu\xE1rio. Use quando o usu\xE1rio pedir para criar uma dieta, plano alimentar, ou definir metas nutricionais. Exemplos: 'Crie uma dieta para perder peso', 'Monta um plano de 2000 calorias', 'Quero um plano low carb'",
  inputSchema: createMealPlanToolInput,
  outputSchema: createMealPlanToolOutput,
  execute: async (inputData, executionContext) => {
    const {
      plan_name,
      description,
      daily_calories,
      daily_protein_g,
      daily_fat_g,
      daily_carbs_g,
      meals = []
    } = inputData;
    const { userId, authToken } = extractAuthContext(executionContext);
    if (!userId) {
      throw new Error(
        "Usu\xE1rio n\xE3o autenticado. Por favor, fa\xE7a login para criar planos alimentares."
      );
    }
    logger.info(
      `\u{1F4CB} [Tool:createMealPlan] Criando plano para usu\xE1rio: ${userId}`
    );
    try {
      const result = await createMealPlan(
        {
          user_id: userId,
          plan_name,
          description,
          daily_calories,
          daily_protein_g,
          daily_fat_g,
          daily_carbs_g,
          created_by: "ai",
          meals
        },
        void 0,
        authToken
      );
      logger.info(`\u2705 [Tool:createMealPlan] Plano criado: ${result.id}`);
      return {
        id: result.id,
        plan_name: result.plan_name,
        daily_calories: result.daily_calories,
        created_by: result.created_by,
        message: `Plano alimentar "${plan_name}" criado com sucesso! Meta di\xE1ria: ${daily_calories} kcal, ${daily_protein_g}g de prote\xEDna, ${daily_carbs_g}g de carboidratos e ${daily_fat_g}g de gordura.`
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      logger.error(`\u274C [Tool:createMealPlan] Erro: ${errorMessage}`);
      throw new Error(`Erro ao criar plano alimentar: ${errorMessage}`);
    }
  }
});

"use strict";
const nutritionSchema = z$1.object({
  calories: z$1.number(),
  protein_g: z$1.number(),
  carbs_g: z$1.number(),
  fat_g: z$1.number()
});
const nutritionWithFiber = nutritionSchema.extend({
  fiber_g: z$1.number()
});

"use strict";
const foodBaseSchema = z$1.object({
  id: z$1.string(),
  name: z$1.string(),
  category: z$1.string()
});
const foodWithNutritionSchema = foodBaseSchema.extend({
  nutrition: nutritionSchema
});
const foodWithPortionSchema = foodWithNutritionSchema.extend({
  portion: z$1.string()
});
const similarFoodSchema = foodBaseSchema.extend({
  nutrition: nutritionWithFiber,
  similarity_score: z$1.number(),
  similarity_percent: z$1.number()
});
const recommendedFoodSchema = foodBaseSchema.extend({
  portion: z$1.string(),
  nutrition: nutritionSchema,
  source: z$1.string(),
  is_verified: z$1.boolean()
});

"use strict";
const baseOutputSchema = z$1.object({
  success: z$1.boolean(),
  error: z$1.string().optional()
});
const searchFoodOutputSchema = baseOutputSchema.extend({
  foods: z$1.array(foodWithPortionSchema),
  count: z$1.number()
});
const findSimilarOutputSchema = baseOutputSchema.extend({
  referenceFood: foodWithNutritionSchema,
  similarFoods: z$1.array(similarFoodSchema),
  count: z$1.number()
});
const nutritionDetailSchema = z$1.object({
  foodId: z$1.string(),
  foodName: z$1.string(),
  quantity_g: z$1.number(),
  calories: z$1.number(),
  protein_g: z$1.number(),
  carbs_g: z$1.number(),
  fat_g: z$1.number()
});
const calculateNutritionOutputSchema = baseOutputSchema.extend({
  total: nutritionSchema,
  details: z$1.array(nutritionDetailSchema)
});
const filtersAppliedSchema = z$1.object({
  dietary_restrictions: z$1.array(z$1.string()),
  allergies: z$1.array(z$1.string()),
  disliked_foods: z$1.array(z$1.string())
});
const recommendationOutputSchema = baseOutputSchema.extend({
  foods: z$1.array(recommendedFoodSchema),
  count: z$1.number(),
  filters_applied: filtersAppliedSchema
});

"use strict";
const toNum$1 = (v) => Number(v) || 0;
const formatFoodItem = (food) => ({
  id: food.id,
  name: food.name,
  category: food.category ?? "Sem categoria",
  portion: "100g",
  nutrition: {
    calories: toNum$1(food.calorie_per_100g),
    protein_g: toNum$1(food.protein_g_100g),
    carbs_g: toNum$1(food.carbs_g_100g),
    fat_g: toNum$1(food.fat_g_100g)
  }
});
const searchFoodCatalogTool = createTool({
  id: "search-food-catalog",
  description: "Busca alimentos no cat\xE1logo nutricional por nome ou categoria. Retorna informa\xE7\xF5es nutricionais b\xE1sicas.",
  inputSchema: z.object({
    query: z.string().describe("Termo de busca (nome do alimento ou categoria)"),
    limit: z.number().optional().default(5).describe("N\xFAmero m\xE1ximo de resultados (padr\xE3o: 5)")
  }),
  outputSchema: searchFoodOutputSchema,
  execute: async (inputData, executionContext) => {
    const { query, limit = 5 } = inputData;
    const { authToken } = extractAuthContext(executionContext);
    logger.info(`\u{1F50D} [Tool] Buscando alimentos (sem\xE2ntica): "${query}" (limite: ${limit})`);
    try {
      const response = await searchFoodsByEmbedding({ query, limit }, void 0, authToken);
      const foods = response.similar_foods.map(formatFoodItem);
      logger.info(`\u2705 [Tool] Encontrados ${foods.length} alimentos`);
      return {
        success: true,
        foods,
        count: foods.length
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      logger.error(`\u274C [Tool] Erro na busca: ${errorMessage}`);
      return {
        success: false,
        foods: [],
        count: 0,
        error: `N\xE3o foi poss\xEDvel buscar alimentos: ${errorMessage}`
      };
    }
  }
});

"use strict";
const formatNutritionDetail = (detail) => ({
  foodId: detail.food_id,
  foodName: detail.food_name,
  quantity_g: detail.quantity_g,
  calories: detail.calories,
  protein_g: detail.protein_g,
  carbs_g: detail.carbs_g,
  fat_g: detail.fat_g
});
const calculateNutritionTool = createTool({
  id: "calculate-nutrition",
  description: "Utilize essa tool exclusivamente para calculo de alimentosN\xE3o utilize essa tool para calculo nutricional de macros do usu\xE1rio, ao inves disso, utilize a tool calculate-macrosCalcula valores nutricionais totais para uma lista de alimentos com quantidades espec\xEDficas",
  inputSchema: z.object({
    foods: z.array(
      z.object({
        foodId: z.string().describe("ID do alimento no cat\xE1logo"),
        quantity_g: z.number().describe("Quantidade em gramas")
      })
    ).describe("Lista de alimentos com quantidades")
  }),
  outputSchema: calculateNutritionOutputSchema,
  execute: async (inputData, executionContext) => {
    const { foods } = inputData;
    const { authToken } = extractAuthContext(executionContext);
    logger.info(`\u{1F9EE} [Tool] Calculando nutri\xE7\xE3o para ${foods.length} alimentos`);
    try {
      const apiRequest = foods.map((f) => ({
        food_id: f.foodId,
        quantity: f.quantity_g
      }));
      const response = await calculateNutrition(apiRequest, void 0, authToken);
      const details = response.details.map(formatNutritionDetail);
      logger.info(`\u2705 [Tool] Total calculado: ${response.total.calories} kcal`);
      return {
        success: true,
        total: {
          calories: response.total.calories,
          protein_g: response.total.protein_g,
          carbs_g: response.total.carbs_g,
          fat_g: response.total.fat_g
        },
        details
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      logger.error(`\u274C [Tool] Erro no c\xE1lculo: ${errorMessage}`);
      return {
        success: false,
        total: {
          calories: 0,
          protein_g: 0,
          carbs_g: 0,
          fat_g: 0
        },
        details: [],
        error: `N\xE3o foi poss\xEDvel calcular nutri\xE7\xE3o: ${errorMessage}`
      };
    }
  }
});

"use strict";
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const toNum = (v) => Number(v) || 0;
const formatSimilarFood = (food) => ({
  id: food.id,
  name: food.name,
  category: food.category ?? "Sem categoria",
  nutrition: {
    calories: toNum(food.calorie_per_100g),
    protein_g: toNum(food.protein_g_100g),
    carbs_g: toNum(food.carbs_g_100g),
    fat_g: toNum(food.fat_g_100g),
    fiber_g: toNum(food.fiber_g_100g)
  },
  similarity_score: food.similarity_score,
  similarity_percent: Math.round(food.similarity_score * 100)
});
const findSimilarFoodsTool = createTool({
  id: "find-similar-foods",
  description: "Encontra alimentos com perfil nutricional similar a um alimento de refer\xEAncia. \xDAtil para sugerir substitui\xE7\xF5es em dietas, encontrar alternativas mais saud\xE1veis, ou descobrir op\xE7\xF5es com macronutrientes equivalentes.",
  inputSchema: z.object({
    foodId: z.string().describe('Nome do alimento ou UUID. Exemplos: "hummus", "frango grelhado", "3f8a...uuid"'),
    limit: z.number().optional().default(5).describe("N\xFAmero m\xE1ximo de alimentos similares (padr\xE3o: 5)"),
    sameCategory: z.boolean().optional().default(false).describe("Se true, retorna apenas alimentos da mesma categoria"),
    tolerance: z.number().optional().default(0.3).describe("Toler\xE2ncia de diferen\xE7a nutricional (0.3 = 30% de diferen\xE7a permitida)")
  }),
  outputSchema: findSimilarOutputSchema,
  execute: async (inputData, executionContext) => {
    const { foodId, limit = 5, sameCategory = false, tolerance = 0.3 } = inputData;
    const { authToken } = extractAuthContext(executionContext);
    logger.info(`\u{1F504} [Tool] Buscando alimentos similares a: "${foodId}"`);
    try {
      let resolvedFoodId = foodId;
      if (!UUID_REGEX.test(foodId)) {
        logger.info(`\u{1F50D} [Tool] "${foodId}" n\xE3o \xE9 UUID, buscando por sem\xE2ntica...`);
        const searchResult = await searchFoodsByEmbedding({ query: foodId, limit: 1 }, void 0, authToken);
        if (!searchResult.similar_foods || searchResult.similar_foods.length === 0) {
          return {
            success: false,
            referenceFood: {
              id: foodId,
              name: foodId,
              category: "Desconhecido",
              nutrition: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
            },
            similarFoods: [],
            count: 0,
            error: `Alimento "${foodId}" n\xE3o encontrado no cat\xE1logo.`
          };
        }
        resolvedFoodId = searchResult.similar_foods[0].id;
        logger.info(`\u2705 [Tool] Resolvido "${foodId}" \u2192 ${searchResult.similar_foods[0].name} (${resolvedFoodId})`);
      }
      const response = await findSimilarFoods({
        food_id: resolvedFoodId,
        limit,
        same_category: sameCategory,
        tolerance
      }, void 0, authToken);
      const referenceFood = {
        id: response.reference_food.id,
        name: response.reference_food.name,
        category: response.reference_food.category ?? "Sem categoria",
        nutrition: {
          calories: toNum(response.reference_food.calorie_per_100g),
          protein_g: toNum(response.reference_food.protein_g_100g),
          carbs_g: toNum(response.reference_food.carbs_g_100g),
          fat_g: toNum(response.reference_food.fat_g_100g)
        }
      };
      const similarFoods = response.similar_foods.map(formatSimilarFood);
      logger.info(`\u2705 [Tool] Encontrados ${similarFoods.length} alimentos similares`);
      return {
        success: true,
        referenceFood,
        similarFoods,
        count: similarFoods.length
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      logger.error(`\u274C [Tool] Erro na busca de similares: ${errorMessage}`);
      return {
        success: false,
        referenceFood: {
          id: foodId,
          name: "Desconhecido",
          category: "Desconhecido",
          nutrition: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
        },
        similarFoods: [],
        count: 0,
        error: `N\xE3o foi poss\xEDvel buscar alimentos similares: ${errorMessage}`
      };
    }
  }
});

"use strict";
const formatRecommendedFood = (food) => ({
  id: food.id,
  name: food.name,
  category: food.category ?? "Sem categoria",
  portion: `${food.serving_size_g}${food.serving_unit ?? "g"}`,
  nutrition: {
    calories: food.calorie_per_100g ?? 0,
    protein_g: food.protein_g_100g ?? 0,
    carbs_g: food.carbs_g_100g ?? 0,
    fat_g: food.fat_g_100g ?? 0
  },
  source: food.source,
  is_verified: food.is_verified
});
const recommendationTool = createTool({
  id: "get-recommendations",
  description: "Obt\xE9m recomenda\xE7\xF5es personalizadas de alimentos para um usu\xE1rio com base em seu perfil. Considera restri\xE7\xF5es alimentares, alergias e alimentos que o usu\xE1rio n\xE3o gosta. Pode filtrar por categoria de alimento.",
  inputSchema: z.object({
    // user_id é obtido automaticamente do contexto (resourceId)
    limit: z.number().optional().default(20).describe("N\xFAmero m\xE1ximo de recomenda\xE7\xF5es (padr\xE3o: 20)"),
    category: z.string().optional().describe(
      'Categoria de alimento para filtrar (ex: "protein", "vegetable", "fruit")'
    )
  }),
  outputSchema: recommendationOutputSchema,
  execute: async (inputData, executionContext) => {
    const { limit = 20, category } = inputData;
    const { userId, authToken } = extractAuthContext(executionContext);
    logger.info(
      `\u{1F3AF} [Tool] Buscando recomenda\xE7\xF5es para usu\xE1rio: "${userId}"${category ? ` (categoria: ${category})` : ""}`
    );
    try {
      const response = await getRecommendations(
        {
          user_id: userId,
          limit,
          ...category && { category }
        },
        defaultConfig,
        authToken
      );
      const foods = response.foods.map(formatRecommendedFood);
      logger.info(`\u2705 [Tool] Encontradas ${foods.length} recomenda\xE7\xF5es`);
      return {
        success: true,
        foods,
        count: foods.length,
        filters_applied: response.filters_applied
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      logger.error(`\u274C [Tool] Erro nas recomenda\xE7\xF5es: ${errorMessage}`);
      return {
        success: false,
        foods: [],
        count: 0,
        filters_applied: {
          dietary_restrictions: [],
          allergies: [],
          disliked_foods: []
        },
        error: `N\xE3o foi poss\xEDvel obter recomenda\xE7\xF5es: ${errorMessage}`
      };
    }
  }
});

"use strict";
const logMealToolInput = z.object({
  // user_id é obtido automaticamente do contexto (resourceId)
  meal_type: z.enum(["breakfast", "lunch", "dinner", "snack"]).describe("Tipo de refei\xE7\xE3o (breakfast, lunch, dinner, snack)"),
  foods: z.array(
    z.object({
      food_id: z.string().describe("ID do alimento"),
      quantity_g: z.number().positive().describe("Quantidade em gramas"),
      name: z.string().optional().describe("Nome do alimento (opcional)")
    })
  ).min(1).describe("Lista de alimentos consumidos"),
  notes: z.string().optional().describe("Notas sobre a refei\xE7\xE3o (opcional)")
});
const logMealTool = createTool({
  id: "log_meal",
  description: "Registra uma refei\xE7\xE3o consumida pelo usu\xE1rio com todos os alimentos e quantidades. Calcula automaticamente os totais nutricionais e atualiza as estat\xEDsticas di\xE1rias. Use esta ferramenta quando o usu\xE1rio disser que comeu, consumiu ou registrou uma refei\xE7\xE3o. Exemplos: 'Comi 2 ovos no caf\xE9 da manh\xE3', 'Registrar almo\xE7o com arroz e feij\xE3o'",
  inputSchema: logMealToolInput,
  outputSchema: z.object({
    id: z.string().describe("ID do registro da refei\xE7\xE3o"),
    total_calories: z.number().describe("Total de calorias da refei\xE7\xE3o"),
    total_protein_g: z.number().describe("Total de prote\xEDna em gramas"),
    total_carbs_g: z.number().describe("Total de carboidratos em gramas"),
    total_fat_g: z.number().describe("Total de gordura em gramas"),
    meal_type: z.string().describe("Tipo de refei\xE7\xE3o"),
    num_foods: z.number().describe("N\xFAmero de alimentos na refei\xE7\xE3o")
  }),
  execute: async (inputData, executionContext) => {
    const { meal_type, foods, notes } = inputData;
    const { userId, authToken } = extractAuthContext(executionContext);
    logger.info(`\u{1F37D}\uFE0F [Tool:logMeal] Registrando refei\xE7\xE3o para usu\xE1rio: ${userId}`);
    logger.info(`   Tipo: ${meal_type}, Alimentos: ${foods.length}`);
    try {
      const result = await logMeal(
        {
          user_id: userId,
          meal_type,
          foods,
          notes
        },
        void 0,
        authToken
      );
      return {
        id: result.id,
        total_calories: result.total_calories,
        total_protein_g: result.total_protein_g,
        total_carbs_g: result.total_carbs_g,
        total_fat_g: result.total_fat_g,
        meal_type: result.meal_type,
        num_foods: result.foods.length
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erro desconhecido";
      logger.error(`\u274C [Tool:logMeal] Erro: ${msg}`);
      return {
        id: "",
        total_calories: 0,
        total_protein_g: 0,
        total_carbs_g: 0,
        total_fat_g: 0,
        meal_type,
        num_foods: 0
      };
    }
  }
});

"use strict";
const getDailySummaryToolInput = z.object({
  // user_id é obtido automaticamente do contexto (resourceId)
  date: z.string().optional().describe("Data no formato YYYY-MM-DD (opcional, padr\xE3o: hoje)")
});
const getDailySummaryTool = createTool({
  id: "get_daily_summary",
  description: "Obt\xE9m o resumo nutricional completo do dia para um usu\xE1rio, incluindo: - Todas as refei\xE7\xF5es registradas - Totais de calorias e macronutrientes consumidos - Metas nutricionais do usu\xE1rio - Progresso em rela\xE7\xE3o \xE0s metas (percentuais) - N\xFAmero de refei\xE7\xF5es feitas Use quando o usu\xE1rio perguntar sobre seu dia, progresso ou consumo di\xE1rio. Exemplos: 'Como est\xE1 meu dia hoje?', 'Quantas calorias j\xE1 consumi?', 'Estou dentro das minhas metas?'",
  inputSchema: getDailySummaryToolInput,
  outputSchema: z.object({
    date: z.string().describe("Data do resumo"),
    num_meals: z.number().describe("N\xFAmero de refei\xE7\xF5es registradas"),
    totals: z.object({
      calories: z.number(),
      protein_g: z.number(),
      carbs_g: z.number(),
      fat_g: z.number()
    }),
    targets: z.object({
      calories: z.number(),
      protein_g: z.number(),
      carbs_g: z.number(),
      fat_g: z.number()
    }),
    progress: z.object({
      calories_pct: z.number().describe("Porcentagem da meta de calorias"),
      protein_pct: z.number().describe("Porcentagem da meta de prote\xEDna"),
      carbs_pct: z.number().describe("Porcentagem da meta de carboidratos"),
      fat_pct: z.number().describe("Porcentagem da meta de gordura")
    }),
    meals: z.array(
      z.object({
        id: z.string(),
        meal_type: z.string(),
        total_calories: z.number(),
        total_protein_g: z.number(),
        total_carbs_g: z.number(),
        total_fat_g: z.number()
      })
    )
  }),
  execute: async (inputData, executionContext) => {
    const { date } = inputData;
    const { userId, authToken } = extractAuthContext(executionContext);
    logger.info(`\u{1F4C8} [Tool:getDailySummary] Obtendo resumo para usu\xE1rio: ${userId} (data: ${date || "hoje"})`);
    try {
      const result = await getDailySummary(userId, date, void 0, authToken);
      return {
        date: result.date,
        num_meals: result.num_meals,
        totals: result.totals,
        targets: result.targets,
        progress: result.progress,
        meals: result.meals.map((meal) => ({
          id: meal.id,
          meal_type: meal.meal_type,
          total_calories: meal.total_calories,
          total_protein_g: meal.total_protein_g,
          total_carbs_g: meal.total_carbs_g,
          total_fat_g: meal.total_fat_g
        }))
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erro desconhecido";
      logger.error(`\u274C [Tool:getDailySummary] Erro: ${msg}`);
      return {
        date: date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
        num_meals: 0,
        totals: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
        targets: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
        progress: { calories_pct: 0, protein_pct: 0, carbs_pct: 0, fat_pct: 0 },
        meals: []
      };
    }
  }
});

"use strict";
const getWeeklyStatsToolInput = z.object({
  // user_id é obtido automaticamente do contexto (resourceId)
  days: z.number().int().min(1).max(30).optional().default(7).describe("N\xFAmero de dias para incluir (1-30, padr\xE3o: 7)")
});
const getWeeklyStatsTool = createTool({
  id: "get_weekly_stats",
  description: "Obt\xE9m estat\xEDsticas nutricionais agregadas de um per\xEDodo (padr\xE3o: \xFAltimos 7 dias), incluindo: - Estat\xEDsticas di\xE1rias detalhadas - M\xE9dias de calorias e macronutrientes - Taxa de ader\xEAncia (% de dias com refei\xE7\xF5es registradas) - Tend\xEAncias e padr\xF5es alimentares Use quando o usu\xE1rio perguntar sobre sua semana, tend\xEAncias ou evolu\xE7\xE3o. Exemplos: 'Como foi minha semana?', 'Estou melhorando?', 'Qual minha m\xE9dia de calorias?'",
  inputSchema: getWeeklyStatsToolInput,
  outputSchema: z.object({
    user_id: z.string(),
    num_days: z.number().describe("N\xFAmero de dias com dados"),
    averages: z.object({
      calories: z.number().describe("M\xE9dia di\xE1ria de calorias"),
      protein_g: z.number().describe("M\xE9dia di\xE1ria de prote\xEDna"),
      carbs_g: z.number().describe("M\xE9dia di\xE1ria de carboidratos"),
      fat_g: z.number().describe("M\xE9dia di\xE1ria de gordura")
    }),
    adherence_rate: z.number().describe("Taxa de ader\xEAncia (% de dias com registro)"),
    stats: z.array(
      z.object({
        date: z.string(),
        total_calories: z.number(),
        total_protein_g: z.number(),
        total_carbs_g: z.number(),
        total_fat_g: z.number(),
        num_meals: z.number()
      })
    )
  }),
  execute: async (inputData, executionContext) => {
    const { days = 7 } = inputData;
    const { userId, authToken } = extractAuthContext(executionContext);
    logger.info(`\u{1F4CA} [Tool:getWeeklyStats] Obtendo estat\xEDsticas para usu\xE1rio: ${userId} (dias: ${days})`);
    try {
      const result = await getWeeklyStats(userId, days, void 0, authToken);
      return {
        user_id: result.user_id,
        num_days: result.stats.length,
        averages: result.averages,
        adherence_rate: result.adherence_rate,
        stats: result.stats.map((stat) => ({
          date: stat.date,
          total_calories: stat.total_calories,
          total_protein_g: stat.total_protein_g,
          total_carbs_g: stat.total_carbs_g,
          total_fat_g: stat.total_fat_g,
          num_meals: stat.num_meals
        }))
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erro desconhecido";
      logger.error(`\u274C [Tool:getWeeklyStats] Erro: ${msg}`);
      return {
        user_id: userId,
        num_days: 0,
        averages: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
        adherence_rate: 0,
        stats: []
      };
    }
  }
});

"use strict";
const listMealPlansToolInput = z.object({
  page: z.number().int().min(1).default(1).describe("N\xFAmero da p\xE1gina"),
  page_size: z.number().int().min(1).max(50).default(10).describe("Itens por p\xE1gina")
});
const listMealPlansToolOutput = z.object({
  plans: z.array(
    z.object({
      id: z.string(),
      plan_name: z.string(),
      daily_calories: z.number(),
      created_by: z.string(),
      created_at: z.string()
    })
  ),
  total: z.number().describe("Total de planos"),
  message: z.string().describe("Mensagem descritiva")
});
const listMealPlansTool = createTool({
  id: "list_meal_plans",
  description: "Lista todos os planos alimentares (dietas) do usu\xE1rio. Use quando o usu\xE1rio pedir para ver suas dietas, listar planos, ou consultar planos existentes. Exemplos: 'Quais s\xE3o minhas dietas?', 'Mostre meus planos', 'Tenho alguma dieta cadastrada?'",
  inputSchema: listMealPlansToolInput,
  outputSchema: listMealPlansToolOutput,
  execute: async (inputData, executionContext) => {
    const { page = 1, page_size = 10 } = inputData;
    const { userId, authToken } = extractAuthContext(executionContext);
    if (userId === "anonymous") {
      throw new Error(
        "Usu\xE1rio n\xE3o autenticado. Por favor, fa\xE7a login para ver seus planos."
      );
    }
    logger.info(
      `\u{1F4CB} [Tool:listMealPlans] Listando planos para usu\xE1rio: ${userId}`
    );
    try {
      const result = await listMealPlans(
        userId,
        page,
        page_size,
        void 0,
        authToken
      );
      const plans = result.plans.map((p) => ({
        id: p.id,
        plan_name: p.plan_name,
        daily_calories: p.daily_calories,
        created_by: p.created_by,
        created_at: p.created_at
      }));
      logger.info(`\u2705 [Tool:listMealPlans] Encontrados ${result.total} planos`);
      return {
        plans,
        total: result.total,
        message: result.total === 0 ? "Voc\xEA ainda n\xE3o tem planos alimentares cadastrados." : `Encontrei ${result.total} plano(s) alimentar(es).`
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      logger.error(`\u274C [Tool:listMealPlans] Erro: ${errorMessage}`);
      throw new Error(`Erro ao listar planos: ${errorMessage}`);
    }
  }
});

"use strict";
const getMealPlanToolInput = z.object({
  plan_id: z.string().describe("ID do plano alimentar")
});
const getMealPlanToolOutput = z.object({
  id: z.string(),
  plan_name: z.string(),
  description: z.string().optional(),
  daily_calories: z.number(),
  daily_protein_g: z.number(),
  daily_fat_g: z.number(),
  daily_carbs_g: z.number(),
  created_by: z.string(),
  meals: z.array(z.record(z.unknown())),
  created_at: z.string()
});
const getMealPlanTool = createTool({
  id: "get_meal_plan",
  description: "Busca detalhes de um plano alimentar espec\xEDfico. Use quando o usu\xE1rio pedir detalhes, informa\xE7\xF5es completas, ou quiser ver um plano espec\xEDfico. Exemplos: 'Me mostre detalhes da dieta X', 'Qual \xE9 o plano de 2000 calorias?', 'Informa\xE7\xF5es do meu plano'",
  inputSchema: getMealPlanToolInput,
  outputSchema: getMealPlanToolOutput,
  execute: async (inputData, executionContext) => {
    const { plan_id } = inputData;
    const { userId, authToken } = extractAuthContext(executionContext);
    if (userId === "anonymous") {
      throw new Error(
        "Usu\xE1rio n\xE3o autenticado. Por favor, fa\xE7a login para ver planos."
      );
    }
    logger.info(
      `\u{1F4CB} [Tool:getMealPlan] Buscando plano ${plan_id} para usu\xE1rio: ${userId}`
    );
    try {
      const plan = await getMealPlan(plan_id, userId, void 0, authToken);
      logger.info(
        `\u2705 [Tool:getMealPlan] Plano encontrado: "${plan.plan_name}"`
      );
      return {
        id: plan.id,
        plan_name: plan.plan_name,
        description: plan.description,
        daily_calories: plan.daily_calories,
        daily_protein_g: plan.daily_protein_g,
        daily_fat_g: plan.daily_fat_g,
        daily_carbs_g: plan.daily_carbs_g,
        created_by: plan.created_by,
        meals: plan.meals,
        created_at: plan.created_at
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      logger.error(`\u274C [Tool:getMealPlan] Erro: ${errorMessage}`);
      throw new Error(
        `Erro ao buscar plano: ${errorMessage}. Verifique se o ID est\xE1 correto e se voc\xEA tem permiss\xE3o para acessar este plano.`
      );
    }
  }
});

"use strict";
const updateMealPlanToolInput = z.object({
  plan_id: z.string().describe("ID do plano a atualizar"),
  plan_name: z.string().min(1).max(100).optional().describe("Novo nome do plano"),
  description: z.string().max(500).optional().describe("Nova descri\xE7\xE3o"),
  daily_calories: z.number().positive().optional().describe("Nova meta de calorias"),
  daily_protein_g: z.number().positive().optional().describe("Nova meta de prote\xEDna"),
  daily_fat_g: z.number().positive().optional().describe("Nova meta de gordura"),
  daily_carbs_g: z.number().positive().optional().describe("Nova meta de carboidratos"),
  meals: z.array(z.record(z.unknown())).optional().describe("Novas refei\xE7\xF5es")
});
const updateMealPlanToolOutput = z.object({
  id: z.string(),
  plan_name: z.string(),
  daily_calories: z.number(),
  message: z.string()
});
const updateMealPlanTool = createTool({
  id: "update_meal_plan",
  description: "Atualiza um plano alimentar existente. Use quando o usu\xE1rio pedir para editar, modificar, ajustar um plano. Exemplos: 'Ajusta a dieta para 1800 calorias', 'Muda o nome do plano', 'Adiciona mais prote\xEDna'",
  inputSchema: updateMealPlanToolInput,
  outputSchema: updateMealPlanToolOutput,
  execute: async (inputData, executionContext) => {
    const { plan_id, ...updates } = inputData;
    const { userId, authToken } = extractAuthContext(executionContext);
    if (userId === "anonymous") {
      throw new Error(
        "Usu\xE1rio n\xE3o autenticado. Por favor, fa\xE7a login para editar planos."
      );
    }
    logger.info(
      `\u{1F4CB} [Tool:updateMealPlan] Atualizando plano ${plan_id} para usu\xE1rio: ${userId}`
    );
    try {
      const result = await updateMealPlan(
        plan_id,
        userId,
        updates,
        void 0,
        authToken
      );
      logger.info(
        `\u2705 [Tool:updateMealPlan] Plano atualizado: "${result.plan_name}"`
      );
      return {
        id: result.id,
        plan_name: result.plan_name,
        daily_calories: result.daily_calories,
        message: `Plano "${result.plan_name}" atualizado com sucesso!`
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      logger.error(`\u274C [Tool:updateMealPlan] Erro: ${errorMessage}`);
      throw new Error(
        `Erro ao atualizar plano: ${errorMessage}. Verifique se o ID est\xE1 correto e se voc\xEA tem permiss\xE3o para editar este plano.`
      );
    }
  }
});

"use strict";
const deleteMealPlanToolInput = z.object({
  plan_id: z.string().describe("ID do plano a deletar")
});
const deleteMealPlanToolOutput = z.object({
  success: z.boolean(),
  message: z.string()
});
const deleteMealPlanTool = createTool({
  id: "delete_meal_plan",
  description: "Deleta um plano alimentar. Use quando o usu\xE1rio pedir para excluir, remover, deletar um plano. Exemplos: 'Delete minha dieta antiga', 'Remove o plano X', 'Apaga essa dieta'",
  inputSchema: deleteMealPlanToolInput,
  outputSchema: deleteMealPlanToolOutput,
  execute: async (inputData, executionContext) => {
    const { plan_id } = inputData;
    const { userId, authToken } = extractAuthContext(executionContext);
    if (userId === "anonymous") {
      throw new Error(
        "Usu\xE1rio n\xE3o autenticado. Por favor, fa\xE7a login para deletar planos."
      );
    }
    logger.info(
      `\u{1F4CB} [Tool:deleteMealPlan] Deletando plano ${plan_id} para usu\xE1rio: ${userId}`
    );
    try {
      await deleteMealPlan(plan_id, userId, void 0, authToken);
      logger.info(`\u2705 [Tool:deleteMealPlan] Plano deletado com sucesso`);
      return {
        success: true,
        message: "Plano alimentar deletado com sucesso!"
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      logger.error(`\u274C [Tool:deleteMealPlan] Erro: ${errorMessage}`);
      throw new Error(
        `Erro ao deletar plano: ${errorMessage}. Verifique se o ID est\xE1 correto e se voc\xEA tem permiss\xE3o para deletar este plano.`
      );
    }
  }
});

"use strict";
const confirmAndLogImageMealToolInput = z.object({
  meal_type: z.enum(["breakfast", "lunch", "dinner", "snack"]).describe("Tipo"),
  detected_foods: z.array(
    z.object({
      food_name: z.string().describe("Nome"),
      quantity_g: z.number().describe("Gramas"),
      user_confirmed: z.boolean().default(true).describe("Confirmado"),
      user_adjusted_quantity_g: z.number().optional().describe("Ajustado")
    })
  ).min(1).describe("Alimentos"),
  notes: z.string().optional().describe("Notas")
});
const confirmAndLogImageMealToolOutput = z.object({
  meal_log_id: z.string().describe("ID"),
  total_calories: z.number().describe("Calorias"),
  total_protein_g: z.number().describe("Prote\xEDna"),
  total_carbs_g: z.number().describe("Carbos"),
  total_fat_g: z.number().describe("Gordura"),
  foods_logged: z.number().describe("Qtd"),
  catalog_matches: z.array(
    z.object({
      detected_name: z.string(),
      catalog_food: z.object({
        id: z.string(),
        name: z.string(),
        similarity: z.number()
      })
    })
  ).describe("Matches")
});
const confirmAndLogImageMealTool = createTool({
  id: "confirm_and_log_image_meal",
  description: "Registra refei\xE7\xE3o ap\xF3s an\xE1lise de imagem. Use AP\xD3S analyze_food_image quando usu\xE1rio confirmar. Busca alimentos com embeddings (sem\xE2ntica).",
  inputSchema: confirmAndLogImageMealToolInput,
  outputSchema: confirmAndLogImageMealToolOutput,
  execute: async (inputData, executionContext) => {
    const { meal_type, detected_foods, notes } = inputData;
    const { userId, authToken } = extractAuthContext(executionContext);
    if (userId === "anonymous") {
      throw new Error(
        "Usu\xE1rio n\xE3o autenticado. Por favor, fa\xE7a login para registrar refei\xE7\xF5es."
      );
    }
    logger.info(
      `\u{1F37D}\uFE0F [Tool:confirmAndLogImageMeal] Registrando refei\xE7\xE3o de imagem para: ${userId}`
    );
    logger.info(`   Tipo: ${meal_type}, Alimentos: ${detected_foods.length}`);
    const confirmedFoods = detected_foods.filter((f) => f.user_confirmed);
    const skippedCount = detected_foods.length - confirmedFoods.length;
    if (skippedCount > 0) {
      logger.info(`   \u2298 Pulando ${skippedCount} alimento(s) n\xE3o confirmados`);
    }
    logger.info(
      `   \u{1F50E} Buscando ${confirmedFoods.length} alimento(s) em paralelo (sem\xE2ntica)...`
    );
    const searchResults = await Promise.all(
      confirmedFoods.map(async (food) => {
        try {
          const searchResult = await searchFoodsByEmbedding(
            { query: food.food_name, limit: 1 },
            void 0,
            authToken
          );
          return { food, searchResult, error: null };
        } catch (error) {
          return { food, searchResult: null, error };
        }
      })
    );
    const catalogMatches = [];
    const foodsToLog = [];
    for (const { food, searchResult, error } of searchResults) {
      const quantity = food.user_adjusted_quantity_g || food.quantity_g;
      if (error) {
        logger.error(
          `   \u274C Erro ao buscar '${food.food_name}': ${error instanceof Error ? error.message : "Erro desconhecido"}`
        );
        continue;
      }
      if (searchResult?.similar_foods && searchResult.similar_foods.length > 0) {
        const catalogFood = searchResult.similar_foods[0];
        logger.info(
          `   \u2713 Match: '${catalogFood.name}' (ID: ${catalogFood.id}, score: ${catalogFood.similarity_score})`
        );
        catalogMatches.push({
          detected_name: food.food_name,
          catalog_food: {
            id: catalogFood.id,
            name: catalogFood.name,
            similarity: catalogFood.similarity_score
          }
        });
        foodsToLog.push({
          food_id: catalogFood.id,
          quantity_g: quantity,
          name: catalogFood.name
        });
      } else {
        logger.warn(
          `   \u26A0\uFE0F Nenhum match encontrado para '${food.food_name}'`
        );
      }
    }
    if (foodsToLog.length === 0) {
      throw new Error(
        "Nenhum alimento foi encontrado no cat\xE1logo. Tente ser mais espec\xEDfico com os nomes."
      );
    }
    logger.info(`   \u{1F4BE} Registrando ${foodsToLog.length} alimento(s)...`);
    try {
      const mealLog = await logMeal(
        {
          user_id: userId,
          meal_type,
          foods: foodsToLog,
          notes: notes || "Registrado via an\xE1lise de imagem"
        },
        void 0,
        authToken
      );
      logger.info(
        `   \u2705 Refei\xE7\xE3o registrada! ID: ${mealLog.id}, Calorias: ${mealLog.total_calories} kcal`
      );
      return {
        meal_log_id: mealLog.id,
        total_calories: mealLog.total_calories,
        total_protein_g: mealLog.total_protein_g,
        total_carbs_g: mealLog.total_carbs_g,
        total_fat_g: mealLog.total_fat_g,
        foods_logged: foodsToLog.length,
        catalog_matches: catalogMatches
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erro desconhecido";
      logger.error(`\u274C [Tool:confirmAndLogImageMeal] Erro ao registrar: ${msg}`);
      throw new Error(
        `N\xE3o foi poss\xEDvel registrar a refei\xE7\xE3o: ${msg}. Os alimentos foram identificados corretamente, mas houve um erro no registro.`
      );
    }
  }
});

"use strict";
const exportMealPlanPdfToolInput = z.object({
  plan_id: z.string().describe("ID do plano alimentar para exportar como PDF")
});
const exportMealPlanPdfToolOutput = z.object({
  success: z.boolean(),
  plan_name: z.string(),
  download_url: z.string(),
  message: z.string()
});
const exportMealPlanPdfTool = createTool({
  id: "export_meal_plan_pdf",
  description: "Exporta um plano alimentar como PDF para download. Use quando o usu\xE1rio pedir para gerar, exportar ou baixar o PDF de uma dieta ou plano alimentar. Exemplos: 'gera um PDF da minha dieta', 'exporta meu plano alimentar', 'quero baixar minha dieta em PDF'",
  inputSchema: exportMealPlanPdfToolInput,
  outputSchema: exportMealPlanPdfToolOutput,
  execute: async (inputData, executionContext) => {
    const { plan_id } = inputData;
    const { userId, authToken } = extractAuthContext(executionContext);
    if (userId === "anonymous") {
      throw new Error(
        "Usu\xE1rio n\xE3o autenticado. Por favor, fa\xE7a login para exportar planos."
      );
    }
    logger.info(
      `\u{1F4C4} [Tool:exportMealPlanPdf] Exportando plano ${plan_id} para usu\xE1rio: ${userId}`
    );
    try {
      const plan = await getMealPlan(plan_id, userId, void 0, authToken);
      logger.info(
        `\u2705 [Tool:exportMealPlanPdf] Plano encontrado: "${plan.plan_name}", gerando link de download`
      );
      const download_url = `/api/meal-plans/${plan_id}/pdf`;
      return {
        success: true,
        plan_name: plan.plan_name,
        download_url,
        message: `PDF do plano "${plan.plan_name}" pronto para download.`
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      logger.error(`\u274C [Tool:exportMealPlanPdf] Erro: ${errorMessage}`);
      throw new Error(
        `Erro ao exportar plano como PDF: ${errorMessage}. Verifique se o ID est\xE1 correto e se voc\xEA tem permiss\xE3o para acessar este plano.`
      );
    }
  }
});

"use strict";
const toolSearch = new ToolSearchProcessor({
  tools: {
    searchFoodCatalogTool,
    calculateNutritionTool,
    findSimilarFoodsTool,
    recommendationTool,
    logMealTool,
    getDailySummaryTool,
    getWeeklyStatsTool,
    createMealPlanTool,
    listMealPlansTool,
    getMealPlanTool,
    updateMealPlanTool,
    deleteMealPlanTool,
    // analyzeFoodImageDeticTool, // MVP: agente usa visão nativa do LLM
    confirmAndLogImageMealTool,
    createUserProfileTool,
    updateUserProfileTool,
    calculateMacrosTool,
    exportMealPlanPdfTool
  },
  search: {
    topK: 5,
    minScore: 0.1
  }
});

"use strict";
const nutritionAnalystAgent = new Agent({
  id: "nutrition-analyst",
  name: "nutrition-analyst",
  description: "Agente especializado em an\xE1lise nutricional, identifica\xE7\xE3o de alimentos em imagens e busca de alimentos",
  instructions: loadNutritionAnalystInstructions(),
  model: "github-models/openai/gpt-4o-mini",
  memory: createNutritionMemory(),
  inputProcessors: [toolSearch],
  tools: {
    // Tools estáticas - sempre disponíveis independente do ToolSearchProcessor
    create_user_profile: createUserProfileTool,
    update_user_profile: updateUserProfileTool,
    calculate_macros: calculateMacrosTool,
    create_meal_plan: createMealPlanTool
  }
});

"use strict";
const BACKEND_URL$1 = process.env.BACKEND_URL || "http://localhost:4111";
const JWKS_URL = `${BACKEND_URL$1}/auth/jwks`;
const JWKS = createRemoteJWKSet(new URL(JWKS_URL));
async function verifyJwt(token) {
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: BACKEND_URL$1,
    audience: "nutria"
  });
  if (!payload.sub) {
    throw new Error("JWT missing sub claim");
  }
  return payload;
}
function extractBearerToken(authHeader) {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

"use strict";
const devObservabilityConfig = new Observability({
  configs: {
    default: {
      serviceName: "nutri-ai-dev",
      exporters: [
        // Exportador para console (desenvolvimento)
        new DefaultExporter({
          strategy: "batch-with-updates",
          // Permite updates em tempo real
          logger: new PinoLogger({
            name: "NutriAI-Dev-Observability",
            level: "debug"
          })
        })
      ]
    }
  }
});
const stagingObservabilityConfig = new Observability({
  configs: {
    default: {
      serviceName: "nutri-ai-staging",
      exporters: [
        // Console com batch-with-updates para staging
        new DefaultExporter({
          strategy: "batch-with-updates",
          logger: new PinoLogger({
            name: "NutriAI-Staging-Observability",
            level: "info"
          })
        })
        // TODO: Adicione exporters cloud aqui quando necessário
        // Exemplo: new DataDogExporter({ apiKey: process.env.DD_API_KEY })
      ]
    }
  }
});
const prodObservabilityConfig = new Observability({
  configs: {
    default: {
      serviceName: "nutri-ai-prod",
      exporters: [
        // Console com insert-only e apenas warnings/errors
        new DefaultExporter({
          strategy: "insert-only",
          // Máxima performance - sem updates
          logger: new PinoLogger({
            name: "NutriAI-Prod-Observability",
            level: "warn"
            // Apenas warnings e errors em prod
          })
        })
        // TODO: Adicione exporters cloud de produção aqui
        // Exemplo: new DataDogExporter({ apiKey: process.env.DD_API_KEY_PROD })
        // Exemplo: new NewRelicExporter({ licenseKey: process.env.NR_LICENSE_KEY })
      ]
    }
  }
});
function getObservabilityConfig() {
  const env = process.env.NODE_ENV || "development";
  switch (env) {
    case "production":
      return prodObservabilityConfig;
    case "staging":
      return stagingObservabilityConfig;
    case "development":
    default:
      return devObservabilityConfig;
  }
}

"use strict";
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4111";
const FRONTEND_URL$1 = process.env.FRONTEND_URL || "http://localhost:3000";
const isProd = process.env.NODE_ENV === "production";
const auth = betterAuth({
  baseURL: BACKEND_URL,
  basePath: "/auth",
  database: pool,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 8,
    maxPasswordLength: 128
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    // 7 dias
    updateAge: 60 * 60 * 24,
    // 1 dia
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5
      // 5 minutos
    }
  },
  user: {
    additionalFields: {
      planType: {
        type: "string",
        required: false,
        defaultValue: "free",
        input: true
      },
      avatarUrl: {
        type: "string",
        required: false,
        input: true
      }
    }
  },
  trustedOrigins: [FRONTEND_URL$1],
  advanced: {
    database: {
      generateId: () => randomUUID()
    },
    useSecureCookies: isProd,
    cookieOptions: {
      httpOnly: true,
      sameSite: isProd ? "none" : "lax",
      secure: isProd,
      path: "/"
    }
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 10
  },
  plugins: [
    jwt({
      jwks: {
        keyPairConfig: {
          alg: "EdDSA",
          crv: "Ed25519"
        }
      },
      jwt: {
        issuer: BACKEND_URL,
        audience: "nutria",
        expirationTime: "15m",
        definePayload: ({ user }) => ({
          sub: user.id,
          email: user.email,
          name: user.name
        })
      }
    })
  ]
});

"use strict";
validateEnv();
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const mastra = new Mastra({
  storage: sharedStorage,
  workflows: {},
  agents: {
    nutritionAnalystAgent
  },
  logger: new PinoLogger({
    name: "NutriAI",
    level: "info"
  }),
  observability: getObservabilityConfig(),
  server: {
    cors: {
      origin: [FRONTEND_URL],
      credentials: true,
      allowHeaders: ["Content-Type", "Authorization", "x-mastra-client-type"]
    },
    apiRoutes: [registerApiRoute("/auth/*", {
      method: "ALL",
      handler: async (c) => auth.handler(c.req.raw)
    }), registerApiRoute("/chat", {
      method: "POST",
      handler: async (c) => {
        try {
          const token = extractBearerToken(c.req.header("Authorization"));
          if (!token) {
            return c.json({
              error: "Authorization header com Bearer token \xE9 obrigat\xF3rio"
            }, 401);
          }
          let jwtPayload;
          try {
            jwtPayload = await verifyJwt(token);
          } catch (err) {
            console.error("\u274C JWT verification failed:", err);
            return c.json({
              error: "Token inv\xE1lido ou expirado"
            }, 401);
          }
          const userId = jwtPayload.sub;
          const userEmail = jwtPayload.email;
          const {
            messages
          } = await c.req.json();
          if (!messages || !Array.isArray(messages)) {
            return c.json({
              error: 'Campo "messages" \xE9 obrigat\xF3rio e deve ser um array'
            }, 400);
          }
          const userProfile = await getUserProfileFromDB(userId);
          const contextMessages = [];
          if (userProfile) {
            contextMessages.push(userProfileToContext(userProfile));
            console.log(`\u2705 [Chat] Usu\xE1rio ${userId} com perfil carregado`);
          } else {
            console.log(`\u26A0\uFE0F [Chat] Usu\xE1rio ${userId} sem perfil - continuando sem personaliza\xE7\xE3o`);
            contextMessages.push({
              role: "system",
              content: "SISTEMA: O usu\xE1rio est\xE1 autenticado (logado) mas ainda n\xE3o tem um perfil nutricional cadastrado. Sugira criar um perfil usando a tool create_user_profile. N\xC3O diga que o usu\xE1rio n\xE3o est\xE1 autenticado \u2014 ele EST\xC1 logado."
            });
          }
          console.log("\u{1F4E5} Mastra received:", JSON.stringify({
            userId,
            userEmail,
            messageCount: messages.length
          }, null, 2));
          const requestContext = c.get("requestContext");
          requestContext.set(MASTRA_RESOURCE_ID_KEY, userId);
          requestContext.set(MASTRA_THREAD_ID_KEY, `chat-${userId}`);
          requestContext.set("jwt_token", token);
          return asyncContext.run({
            userId,
            jwtToken: token
          }, async () => {
            const mastra2 = c.get("mastra");
            const nutritionAgent = mastra2.getAgent("nutritionAnalystAgent");
            if (!nutritionAgent) {
              return c.json({
                error: "Agent n\xE3o encontrado"
              }, 500);
            }
            const result = await nutritionAgent.stream(messages, {
              context: contextMessages,
              requestContext
            });
            const uiMessageStream = createUIMessageStream({
              originalMessages: messages,
              execute: async ({
                writer
              }) => {
                for await (const part of toAISdkStream(result, {
                  from: "agent"
                })) {
                  await writer.write(part);
                }
              }
            });
            return createUIMessageStreamResponse({
              stream: uiMessageStream
            });
          });
        } catch (error) {
          console.error("\u274C Erro no endpoint /chat:", error);
          return c.json({
            error: "Erro ao processar a requisi\xE7\xE3o",
            details: error instanceof Error ? error.message : "Erro desconhecido"
          }, 500);
        }
      }
    })]
  }
});

export { mastra };
