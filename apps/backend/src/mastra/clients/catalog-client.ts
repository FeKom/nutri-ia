/**
 * CatalogClient - Cliente HTTP para comunicação com a Food Catalog API
 *
 * Implementado com programação funcional:
 * - Funções puras
 * - Composição de funções
 * - Imutabilidade
 * - Sem classes
 */

import { env } from "../config/env";

// ============================================
// TIPOS
// ============================================

export interface UserProfile {
  id: string;
  user_id: string;
  name: string;
  age: number;
  weight_kg?: number;
  height_cm?: number;
  gender?: string;
  activity_level?: "sedentary" | "light" | "moderate" | "active" | "very_active";
  diet_goal?: "weight_loss" | "weight_gain" | "maintain";
  dietary_restrictions?: string[];
  allergies?: string[];
  disliked_foods?: string[];
  preferred_cuisines?: string[];
}

export interface MealPlan {
  id: string;
  user_id: string;
  plan_name: string;
  description?: string;
  daily_calories: number;
  daily_protein_g: number;
  daily_fat_g: number;
  daily_carbs_g: number;
  created_by: string;
  meals: Record<string, unknown>[];
  created_at: string;
  updated_at: string;
}

export interface CreateMealPlanRequest {
  user_id: string;
  plan_name: string;
  description?: string;
  daily_calories: number;
  daily_protein_g: number;
  daily_fat_g: number;
  daily_carbs_g: number;
  created_by?: "user" | "ai";
  meals?: Record<string, unknown>[];
}

export interface UpdateMealPlanRequest {
  plan_name?: string;
  description?: string;
  daily_calories?: number;
  daily_protein_g?: number;
  daily_fat_g?: number;
  daily_carbs_g?: number;
  meals?: Record<string, unknown>[];
}

export interface MealPlanListResponse {
  plans: MealPlan[];
  total: number;
  page: number;
  page_size: number;
}

export interface SearchFilters {
  category?: string;
  min_protein?: number;
  max_calories?: number;
  source?: "usda" | "taco" | "custom";
  verified_only?: boolean;
}

export interface SearchFoodsRequest {
  query: string;
  limit?: number;
  filters?: SearchFilters;
}

export interface FoodItem {
  id: string;
  name: string;
  category: string | null;
  serving_size_g: number;
  serving_unit: string | null;
  calorie_per_100g: number;
  source: string;
  is_verified: boolean;
  protein_g_100g: number | null;
  carbs_g_100g: number | null;
  fat_g_100g: number | null;
}

export interface SearchFoodsResponse {
  success: boolean;
  foods: FoodItem[];
  count: number;
}

export interface NutritionItem {
  food_id: string;
  quantity: number;
}

export interface NutritionTotals {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  saturated_fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  calcium_mg: number;
  iron_mg: number;
  vitamin_c_mg: number;
}

export interface NutritionDetail {
  food_id: string;
  food_name: string;
  quantity_g: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface CalculateNutritionResponse {
  success: boolean;
  total: NutritionTotals;
  details: NutritionDetail[];
}

export interface SimilarFoodRequest {
  food_id: string;
  limit?: number;
  same_category?: boolean;
  tolerance?: number;
}

export interface SimilarFoodItem {
  id: string;
  name: string;
  category: string | null;
  calorie_per_100g: number | null;
  protein_g_100g: number | null;
  carbs_g_100g: number | null;
  fat_g_100g: number | null;
  fiber_g_100g: number | null;
  similarity_score: number;
  source: string;
  is_verified: boolean;
}

export interface SimilarFoodsResponse {
  success: boolean;
  reference_food: FoodItem;
  similar_foods: SimilarFoodItem[];
  count: number;
}

export interface RecommendationRequest {
  user_id: string;
  limit?: number;
  category?: string;
}

export interface RecommendedFoodItem {
  id: string;
  name: string;
  category: string | null;
  serving_size_g: number;
  serving_unit: string;
  calorie_per_100g: number | null;
  source: string;
  is_verified: boolean;
  protein_g_100g: number | null;
  carbs_g_100g: number | null;
  fat_g_100g: number | null;
}

export interface RecommendationFiltersApplied {
  dietary_restrictions: string[];
  allergies: string[];
  disliked_foods: string[];
}

export interface RecommendationResponse {
  success: boolean;
  foods: RecommendedFoodItem[];
  count: number;
  filters_applied: RecommendationFiltersApplied;
}

export interface UserFiltersResponse {
  user_id: string;
  dietary_restrictions: string[];
  allergies: string[];
  disliked_foods: string[];
}

// ============================================
// TRACKING TYPES
// ============================================

export interface FoodLogItem {
  food_id: string;
  quantity_g: number;
  name?: string;
}

export interface LogMealRequest {
  user_id: string;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  foods: FoodLogItem[];
  consumed_at?: string;
  notes?: string;
}

export interface MealLogResponse {
  id: string;
  user_id: string;
  consumed_at: string;
  meal_type: string;
  foods: Record<string, unknown>[];
  total_calories: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  total_fiber_g?: number;
  total_sodium_mg?: number;
  notes?: string;
  created_at: string;
}

export interface MealSummary {
  id: string;
  meal_type: string;
  consumed_at: string;
  total_calories: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  num_foods: number;
  notes?: string;
}

export interface NutritionProgress {
  calories_pct: number;
  protein_pct: number;
  carbs_pct: number;
  fat_pct: number;
}

export interface DailySummaryResponse {
  date: string;
  meals: MealSummary[];
  totals: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g: number;
    sodium_mg: number;
  };
  targets: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  };
  progress: NutritionProgress;
  num_meals: number;
}

export interface DayStats {
  date: string;
  total_calories: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  num_meals: number;
  target_calories?: number;
  target_protein_g?: number;
}

export interface WeeklyStatsResponse {
  user_id: string;
  stats: DayStats[];
  averages: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  };
  adherence_rate: number;
}

export interface ClientConfig {
  baseUrl: string;
  timeout: number;
  maxRetries: number;
  retryDelay: number;
}

export interface ApiError {
  message: string;
  statusCode?: number;
  isRetryable: boolean;
}

// ============================================
// CONFIGURAÇÃO
// ============================================

/**
 * Cria configuração do client com valores default
 */
export const createConfig = (
  overrides?: Partial<ClientConfig>,
): ClientConfig => ({
  baseUrl: env.CATALOG_API_URL,
  timeout: env.CATALOG_API_TIMEOUT,
  maxRetries: env.CATALOG_API_RETRY_ATTEMPTS,
  retryDelay: env.CATALOG_API_RETRY_DELAY,
  ...overrides,
});

/**
 * Configuração padrão
 */
export const defaultConfig = createConfig();

// ============================================
// HELPERS PUROS
// ============================================

/**
 * Verifica se status HTTP é retryable
 */
const isRetryableStatus = (status: number): boolean =>
  [429, 500, 502, 503, 504].includes(status);

/**
 * Verifica se erro é retryable
 */
const isRetryableError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;

  const retryablePatterns = [
    "AbortError",
    "TimeoutError",
    "fetch failed",
    "network",
    "ECONNREFUSED",
  ];

  return retryablePatterns.some(
    (pattern) =>
      error.name.includes(pattern) || error.message.includes(pattern),
  );
};

/**
 * Cria erro de API padronizado
 */
const createApiError = (
  message: string,
  statusCode?: number,
  isRetryable = false,
): ApiError => ({
  message,
  statusCode,
  isRetryable,
});

/**
 * Delay assíncrono
 */
const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Calcula delay com exponential backoff
 */
const calculateBackoff = (attempt: number, baseDelay: number): number =>
  baseDelay * Math.pow(2, attempt - 1);

// ============================================
// FUNÇÕES DE REQUEST
// ============================================

/**
 * Executa uma única tentativa de request
 */
const executeRequest = async <T>(
  url: string,
  options: RequestInit,
  timeout: number,
): Promise<
  { success: true; data: T } | { success: false; error: ApiError }
> => {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      signal: AbortSignal.timeout(timeout),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return {
        success: false,
        error: createApiError(
          `API retornou status ${response.status}: ${errorBody}`,
          response.status,
          isRetryableStatus(response.status),
        ),
      };
    }

    const data = (await response.json()) as T;
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: createApiError(
        error instanceof Error ? error.message : "Erro desconhecido",
        undefined,
        isRetryableError(error),
      ),
    };
  }
};

/**
 * Executa request com retry automático (recursivo)
 */
const executeWithRetry = async <T>(
  url: string,
  options: RequestInit,
  config: ClientConfig,
  attempt = 1,
): Promise<T> => {
  const result = await executeRequest<T>(url, options, config.timeout);

  if (result.success) {
    return result.data;
  }

  const { error } = result;
  const isLastAttempt = attempt >= config.maxRetries;

  console.warn(
    `⚠️ [CatalogClient] Tentativa ${attempt}/${config.maxRetries} falhou:`,
    error.message,
  );

  if (isLastAttempt || !error.isRetryable) {
    throw new Error(
      `Falha ao conectar com Catalog API após ${attempt} tentativa(s): ${error.message}`,
    );
  }

  const delay = calculateBackoff(attempt, config.retryDelay);
  console.log(`⏳ [CatalogClient] Aguardando ${delay}ms antes de retry...`);
  await sleep(delay);

  // Recursão para próxima tentativa
  return executeWithRetry(url, options, config, attempt + 1);
};

/**
 * Faz request POST para a API
 */
const postRequest = <T>(
  endpoint: string,
  body: unknown,
  config: ClientConfig,
  authToken?: string,
): Promise<T> => {
  const url = `${config.baseUrl}${endpoint}`;
  const headers: Record<string, string> = {};
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  return executeWithRetry<T>(
    url,
    {
      method: "POST",
      body: JSON.stringify(body),
      headers,
    },
    config,
  );
};

// ============================================
// API PÚBLICA - Funções principais
// ============================================

/**
 * Busca alimentos no catálogo
 *
 * @example
 * const result = await searchFoods({ query: 'frango', limit: 5 });
 */
export const searchFoods = async (
  request: SearchFoodsRequest,
  config = defaultConfig,
  authToken?: string,
): Promise<SearchFoodsResponse> => {
  console.log(`🔍 [CatalogClient] Buscando alimentos: "${request.query}"`);

  const response = await postRequest<SearchFoodsResponse>(
    "/api/v1/foods/search",
    {
      query: request.query,
      limit: request.limit ?? 10,
      filters: request.filters ?? {},
    },
    config,
    authToken,
  );

  console.log(`✅ [CatalogClient] Encontrados ${response.count} alimentos`);

  return response;
};

/**
 * Busca alimentos usando similaridade de embeddings (busca semântica)
 *
 * Mais efetivo que searchFoods para nomes complexos ou descritivos.
 * Usa cosine similarity com pgvector para encontrar matches semânticos.
 *
 * @example
 * const result = await searchFoodsByEmbedding({
 *   query: 'chicken in creamy sauce',
 *   limit: 5
 * });
 */
export const searchFoodsByEmbedding = async (
  request: SearchFoodsRequest,
  config = defaultConfig,
  authToken?: string,
): Promise<SimilarFoodsResponse> => {
  console.log(`🧠 [CatalogClient] Busca semântica: "${request.query}"`);

  const response = await postRequest<SimilarFoodsResponse>(
    "/api/v1/foods/search-by-embedding",
    {
      query: request.query,
      limit: request.limit ?? 10,
      filters: request.filters ?? {},
    },
    config,
    authToken,
  );

  console.log(
    `✅ [CatalogClient] Encontrados ${response.count} alimentos similares`,
  );

  return response;
};

/**
 * Calcula valores nutricionais totais
 *
 * @example
 * const result = await calculateNutrition([
 *   { food_id: 'uuid-1', quantity: 100 },
 *   { food_id: 'uuid-2', quantity: 150 },
 * ]);
 */
export const calculateNutrition = async (
  foods: NutritionItem[],
  config = defaultConfig,
  authToken?: string,
): Promise<CalculateNutritionResponse> => {
  console.log(
    `🧮 [CatalogClient] Calculando nutrição para ${foods.length} alimentos`,
  );

  const response = await postRequest<CalculateNutritionResponse>(
    "/api/v1/nutrition/calculate",
    { foods },
    config,
    authToken,
  );

  console.log(
    `✅ [CatalogClient] Total calculado: ${response.total.calories} kcal`,
  );

  return response;
};

/**
 * Busca alimentos com perfil nutricional similar
 *
 * @example
 * const result = await findSimilarFoods({
 *   food_id: 'uuid-here',
 *   limit: 10,
 *   same_category: false,
 *   tolerance: 0.3,
 * });
 */
export const findSimilarFoods = async (
  request: SimilarFoodRequest,
  config = defaultConfig,
  authToken?: string,
): Promise<SimilarFoodsResponse> => {
  console.log(
    `🔄 [CatalogClient] Buscando alimentos similares para: "${request.food_id}"`,
  );

  const response = await postRequest<SimilarFoodsResponse>(
    "/api/v1/foods/similar",
    {
      food_id: request.food_id,
      limit: request.limit ?? 10,
      same_category: request.same_category ?? false,
      tolerance: request.tolerance ?? 0.3,
    },
    config,
    authToken,
  );

  console.log(
    `✅ [CatalogClient] Encontrados ${response.count} alimentos similares`,
  );

  return response;
};

/**
 * Busca recomendações personalizadas de alimentos para um usuário
 *
 * @example
 * const result = await getRecommendations({
 *   user_id: 'uuid-here',
 *   limit: 20,
 *   category: 'protein',
 * });
 */
export const getRecommendations = async (
  request: RecommendationRequest,
  config = defaultConfig,
  authToken?: string,
): Promise<RecommendationResponse> => {
  console.log(
    `🎯 [CatalogClient] Buscando recomendações para usuário: "${request.user_id}"`,
  );

  const response = await postRequest<RecommendationResponse>(
    "/api/v1/recommendations",
    {
      user_id: request.user_id,
      limit: request.limit ?? 50,
      ...(request.category && { category: request.category }),
    },
    config,
    authToken,
  );

  console.log(`✅ [CatalogClient] Encontradas ${response.count} recomendações`);

  return response;
};

/**
 * Registra uma refeição consumida
 *
 * @example
 * const result = await logMeal({
 *   user_id: 'uuid-here',
 *   meal_type: 'breakfast',
 *   foods: [
 *     { food_id: 'uuid-food', quantity_g: 100, name: 'Aveia' }
 *   ],
 *   notes: 'Café da manhã pós-treino'
 * });
 */
export const logMeal = async (
  request: LogMealRequest,
  config = defaultConfig,
  authToken?: string,
): Promise<MealLogResponse> => {
  console.log(
    `📊 [CatalogClient] Registrando ${request.meal_type} com ${request.foods.length} alimentos`,
  );

  const response = await postRequest<MealLogResponse>(
    "/api/v1/tracking/meals/log",
    request,
    config,
    authToken,
  );

  console.log(
    `✅ [CatalogClient] Refeição registrada: ${response.total_calories} kcal`,
  );

  return response;
};

/**
 * Obtém resumo nutricional do dia
 *
 * @example
 * const result = await getDailySummary({
 *   user_id: 'uuid-here',
 *   date: '2024-01-27'
 * });
 */
export const getDailySummary = async (
  userId: string,
  date?: string,
  config = defaultConfig,
  authToken?: string,
): Promise<DailySummaryResponse> => {
  console.log(`📈 [CatalogClient] Obtendo resumo diário para ${userId}`);

  const params = new URLSearchParams({
    ...(date && { target_date: date }),
  });

  const url = `${config.baseUrl}/api/v1/tracking/summary/daily?${params}`;

  const headers: Record<string, string> = {};
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  const result = await executeRequest<DailySummaryResponse>(
    url,
    { method: "GET", headers },
    config.timeout,
  );

  if (!result.success) {
    throw new Error(result.error.message);
  }

  console.log(
    `✅ [CatalogClient] Resumo obtido: ${result.data.num_meals} refeições`,
  );

  return result.data;
};

/**
 * Obtém estatísticas semanais
 *
 * @example
 * const result = await getWeeklyStats({
 *   user_id: 'uuid-here',
 *   days: 7
 * });
 */
export const getWeeklyStats = async (
  userId: string,
  days = 7,
  config = defaultConfig,
  authToken?: string,
): Promise<WeeklyStatsResponse> => {
  console.log(
    `📊 [CatalogClient] Obtendo estatísticas de ${days} dias para ${userId}`,
  );

  const params = new URLSearchParams({
    days: days.toString(),
  });

  const url = `${config.baseUrl}/api/v1/tracking/stats/weekly?${params}`;

  const headers: Record<string, string> = {};
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  const result = await executeRequest<WeeklyStatsResponse>(
    url,
    { method: "GET", headers },
    config.timeout,
  );

  if (!result.success) {
    throw new Error(result.error.message);
  }

  console.log(
    `✅ [CatalogClient] Estatísticas obtidas: ${result.data.stats.length} dias`,
  );

  return result.data;
};

/**
 * Cria um novo plano alimentar
 *
 * @example
 * const result = await createMealPlan({
 *   user_id: 'uuid-here',
 *   plan_name: 'Dieta 2000 Calorias',
 *   daily_calories: 2000,
 *   daily_protein_g: 150,
 *   daily_fat_g: 65,
 *   daily_carbs_g: 200,
 *   created_by: 'ai'
 * });
 */
export const createMealPlan = async (
  request: CreateMealPlanRequest,
  config = defaultConfig,
  authToken?: string,
): Promise<MealPlan> => {
  console.log(
    `📋 [CatalogClient] Criando plano alimentar: "${request.plan_name}"`,
  );

  const response = await postRequest<MealPlan>(
    `/api/v1/meal-plans`,
    request,
    config,
    authToken,
  );

  console.log(`✅ [CatalogClient] Plano criado: ${response.id}`);

  return response;
};

/**
 * Lista todos os planos alimentares de um usuário
 *
 * @example
 * const result = await listMealPlans('uuid-here', 1, 10);
 */
export const listMealPlans = async (
  userId: string,
  page = 1,
  pageSize = 10,
  config = defaultConfig,
  authToken?: string,
): Promise<MealPlanListResponse> => {
  console.log(
    `📋 [CatalogClient] Listando planos alimentares para usuário: ${userId}`,
  );

  const params = new URLSearchParams({
    page: page.toString(),
    page_size: pageSize.toString(),
  });

  const url = `${config.baseUrl}/api/v1/meal-plans?${params}`;

  const headers: Record<string, string> = {};
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  const result = await executeRequest<MealPlanListResponse>(
    url,
    { method: "GET", headers },
    config.timeout,
  );

  if (!result.success) {
    throw new Error(result.error.message);
  }

  console.log(
    `✅ [CatalogClient] Encontrados ${result.data.total} planos alimentares`,
  );

  return result.data;
};

/**
 * Obtém um plano alimentar específico
 *
 * @example
 * const result = await getMealPlan('plan-uuid', 'user-uuid');
 */
export const getMealPlan = async (
  planId: string,
  userId: string,
  config = defaultConfig,
  authToken?: string,
): Promise<MealPlan> => {
  console.log(`📋 [CatalogClient] Obtendo plano alimentar: ${planId}`);

  const url = `${config.baseUrl}/api/v1/meal-plans/${planId}`;

  const headers: Record<string, string> = {};
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  const result = await executeRequest<MealPlan>(
    url,
    { method: "GET", headers },
    config.timeout,
  );

  if (!result.success) {
    throw new Error(result.error.message);
  }

  console.log(`✅ [CatalogClient] Plano obtido: "${result.data.plan_name}"`);

  return result.data;
};

/**
 * Atualiza um plano alimentar existente
 *
 * @example
 * const result = await updateMealPlan('plan-uuid', 'user-uuid', {
 *   daily_calories: 1800
 * });
 */
export const updateMealPlan = async (
  planId: string,
  userId: string,
  updates: UpdateMealPlanRequest,
  config = defaultConfig,
  authToken?: string,
): Promise<MealPlan> => {
  console.log(`📋 [CatalogClient] Atualizando plano alimentar: ${planId}`);

  const url = `${config.baseUrl}/api/v1/meal-plans/${planId}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  const result = await executeRequest<MealPlan>(
    url,
    {
      method: "PUT",
      body: JSON.stringify(updates),
      headers,
    },
    config.timeout,
  );

  if (!result.success) {
    throw new Error(result.error.message);
  }

  console.log(`✅ [CatalogClient] Plano atualizado`);

  return result.data;
};

/**
 * Deleta um plano alimentar
 *
 * @example
 * await deleteMealPlan('plan-uuid', 'user-uuid');
 */
export const deleteMealPlan = async (
  planId: string,
  userId: string,
  config = defaultConfig,
  authToken?: string,
): Promise<void> => {
  console.log(`📋 [CatalogClient] Deletando plano alimentar: ${planId}`);

  const url = `${config.baseUrl}/api/v1/meal-plans/${planId}`;

  const headers: Record<string, string> = {};
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  const result = await executeRequest<void>(
    url,
    { method: "DELETE", headers },
    config.timeout,
  );

  if (!result.success) {
    throw new Error(result.error.message);
  }

  console.log(`✅ [CatalogClient] Plano deletado`);
};

export interface CreateUserProfileRequest {
  user_id: string;
  name: string;
  age: number;
  weight_kg?: number;
  height_cm?: number;
  gender?: string;
  activity_level?: string;
  diet_goal?: string;
  dietary_restrictions?: string[];
  allergies?: string[];
  disliked_foods?: string[];
  preferred_cuisines?: string[];
}

export const createUserProfile = async (
  request: CreateUserProfileRequest,
  config = defaultConfig,
  authToken?: string,
): Promise<UserProfile> => {
  console.log(
    `👤 [CatalogClient] Criando perfil para usuário: ${request.user_id}`,
  );

  const response = await postRequest<UserProfile>(
    "/api/v1/users/profiles",
    request,
    config,
    authToken,
  );

  console.log(`✅ [CatalogClient] Perfil criado: ${response.user_id}`);

  return response;
};

export interface UpdateUserProfileRequest {
  weight_kg?: number;
  height_cm?: number;
  age?: number;
  gender?: string;
  activity_level?: string;
  diet_goal?: string;
  dietary_restrictions?: string[];
  allergies?: string[];
  disliked_foods?: string[];
  preferred_cuisines?: string[];
}

export const updateUserProfile = async (
  request: UpdateUserProfileRequest,
  config = defaultConfig,
  authToken?: string,
): Promise<UserProfile> => {
  console.log(`✏️ [CatalogClient] Atualizando perfil do usuário`);

  const url = `${config.baseUrl}/api/v1/users/profiles/me`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  const result = await executeRequest<UserProfile>(
    url,
    { method: "PUT", body: JSON.stringify(request), headers },
    config.timeout,
  );

  if (!result.success) {
    throw new Error(result.error.message);
  }

  console.log(`✅ [CatalogClient] Perfil atualizado`);
  return result.data;
};

export interface AnalyzeImageRequest {
  image: string;
  top_k_per_food?: number;
  confidence_threshold?: number;
}

export interface ImageAnalysisMatch {
  detected_name: string;
  matches: Array<{
    id: string;
    name: string;
    similarity: number;
    category: string | null;
    calories_per_100g: number | null;
    serving_size_g: number;
    serving_unit: string;
    source: string;
    is_verified: boolean;
  }>;
}

export interface ImageAnalysisResponse {
  success: boolean;
  detected_foods: string[];
  catalog_matches: ImageAnalysisMatch[];
  total_detected: number;
  total_catalog_matches: number;
  message?: string;
}

export const analyzeImageWithDetic = async (
  request: AnalyzeImageRequest,
  config = defaultConfig,
  authToken?: string,
): Promise<ImageAnalysisResponse> => {
  console.log(`📸 [CatalogClient] Analisando imagem com DETIC`);

  const response = await postRequest<ImageAnalysisResponse>(
    "/api/v1/foods/analyze",
    request,
    config,
    authToken,
  );

  console.log(
    `✅ [CatalogClient] DETIC: ${response.total_detected} alimento(s) detectado(s)`,
  );

  return response;
};

/**
 * Verifica se a API está disponível
 */
export const healthCheck = async (config = defaultConfig): Promise<boolean> => {
  try {
    const response = await fetch(`${config.baseUrl}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(config.timeout),
    });
    return response.ok;
  } catch {
    return false;
  }
};

/**
 * Cria funções do client com configuração customizada
 * (currying para injeção de dependência)
 *
 * @example
 * const client = createClient({ baseUrl: 'http://api.example.com' });
 * const result = await client.searchFoods({ query: 'banana' });
 */
export const createClient = (customConfig?: Partial<ClientConfig>) => {
  const config = createConfig(customConfig);

  return {
    searchFoods: (request: SearchFoodsRequest) => searchFoods(request, config),
    searchFoodsByEmbedding: (request: SearchFoodsRequest) =>
      searchFoodsByEmbedding(request, config),
    calculateNutrition: (foods: NutritionItem[]) =>
      calculateNutrition(foods, config),
    findSimilarFoods: (request: SimilarFoodRequest) =>
      findSimilarFoods(request, config),
    getRecommendations: (request: RecommendationRequest) =>
      getRecommendations(request, config),
    logMeal: (request: LogMealRequest) => logMeal(request, config),
    getDailySummary: (userId: string, date?: string) =>
      getDailySummary(userId, date, config),
    getWeeklyStats: (userId: string, days?: number) =>
      getWeeklyStats(userId, days, config),
    createMealPlan: (request: CreateMealPlanRequest) =>
      createMealPlan(request, config),
    listMealPlans: (userId: string, page?: number, pageSize?: number) =>
      listMealPlans(userId, page, pageSize, config),
    getMealPlan: (planId: string, userId: string) =>
      getMealPlan(planId, userId, config),
    updateMealPlan: (
      planId: string,
      userId: string,
      updates: UpdateMealPlanRequest,
    ) => updateMealPlan(planId, userId, updates, config),
    deleteMealPlan: (planId: string, userId: string) =>
      deleteMealPlan(planId, userId, config),
    healthCheck: () => healthCheck(config),
    config,
  };
};
