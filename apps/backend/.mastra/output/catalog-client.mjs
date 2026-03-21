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
  NODE_ENV: "development",
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

export { analyzeImageWithDetic as a, createMealPlan as b, calculateNutrition as c, createUserProfile as d, defaultConfig as e, deleteMealPlan as f, getMealPlan as g, findSimilarFoods as h, getDailySummary as i, getWeeklyStats as j, listMealPlans as k, logMeal as l, getRecommendations as m, updateUserProfile as n, searchFoodsByEmbedding as s, updateMealPlan as u, validateEnv as v };
