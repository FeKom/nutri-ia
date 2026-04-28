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
import type {
  UserProfile,
  CreateUserProfileRequest,
  UpdateUserProfileRequest,
} from "../schemas/user";
import type {
  MealPlan,
  CreateMealPlanRequest,
  UpdateMealPlanRequest,
  MealPlanListResponse,
} from "../schemas/meal_plan";
import type {
  FoodLogItem,
  LogMealRequest,
  MealLogResponse,
  MealSummary,
  NutritionProgress,
  DailySummaryResponse,
  DayStats,
  WeeklyStatsResponse,
} from "../schemas/tracking";

import { logger } from "../../utils/logger";

export type {
  UserProfile,
  CreateUserProfileRequest,
  UpdateUserProfileRequest,
  MealPlan,
  CreateMealPlanRequest,
  UpdateMealPlanRequest,
  MealPlanListResponse,
  FoodLogItem,
  LogMealRequest,
  MealLogResponse,
  MealSummary,
  NutritionProgress,
  DailySummaryResponse,
  DayStats,
  WeeklyStatsResponse,
};

// ============================================
// TIPOS
// ============================================

export interface SearchFilters {
  category?: string;
  min_protein?: number;
  max_calories?: number;
  source?: "usda" | "taco" | "custom";
  verified_only?: boolean;
}

export interface SearchFoodsRequest {
  query: string[];
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
// TRACKING TYPES — re-exported from ../schemas/tracking
// ============================================

export interface ClientConfig {
  baseUrl: string;
  timeout: number;
  maxRetries: number;
  retryDelay: number;
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
 * Cria erro de API padronizado
 */
const createApiError = (message: string, statusCode?: number, isRetryable?: boolean, rawError?: unknown) => ({ message, statusCode, isRetryable, rawError });

export type ApiError =  ReturnType<typeof createApiError>;

export type NutriaResponse<T> = {success: true; data: T; error?: never} | {success: false; data?: T, error: ApiError};
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
type RequestOptions = RequestInit & {
  message?: string,
  code?: number,
}

export const NutriaRequest = async <T>(
  url: string,
  options: RequestOptions = {},
  timeout?: number | 3000,
  fn?:(() => unknown),
): Promise<NutriaResponse<T>> => {
  const abort = new AbortController();
  const id = setTimeout(() => abort.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...options,
      signal: abort.signal,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    clearTimeout(id);
    if (!response.ok) {
      const rawError = await response.json().catch(() => ({}));
      if (fn) fn();
      return {
        success: false,
        error: createApiError(
          options.message ?? `Api Error: ${response.statusText}`,
          options.code ?? response.status,
          false,
          rawError,
        ),
      };
    }

    const data = (await response.json()) as T;
    return { success: true, data };
  } catch (error) {
    clearTimeout(id);
    const isTimeout = (error as Error).name === "AbortError";
    return {
      success: false,
      error: createApiError(
        isTimeout ? "Request Timeout" : (options.message ?? "Failed to connect Server"),
        isTimeout ? 408 : (options.code ?? 500),
        true,
      ),
    };
  }
};

/**
 * Executa request com retry automático (recursivo)
 */
const NutriaRetryRequest = async <T>(
  url: string,
  options: RequestInit,
  config: ClientConfig,
  attempt = 1,
): Promise<NutriaResponse<T>> => {
  const result = await NutriaRequest<T>(url, options, config.timeout);

  if (result.success) {
    return result;
  }

  const { error } = result;
  const isLastAttempt = attempt >= config.maxRetries;

  console.warn(
    `⚠️ [CatalogClient] Tentativa ${attempt}/${config.maxRetries} falhou:`,
    error.message,
  );

  if (isLastAttempt || !error.isRetryable) {
    return {
      success: false,
      error: { ...error, message: `Falha ao conectar com Catalog API após ${attempt} tentativa(s): ${error.message}` },
    };
  }

  const delay = calculateBackoff(attempt, config.retryDelay);
  console.log(`⏳ [CatalogClient] Aguardando ${delay}ms antes de retry...`);
  await sleep(delay);

  return NutriaRetryRequest(url, options, config, attempt + 1);
};

/**
 * Faz request POST para a API
 */
export const postRequest = <T>(
  endpoint: string,
  body: unknown,
  config: ClientConfig,
  authToken?: string,
): Promise<NutriaResponse<T>> => {
  const url = `${config.baseUrl}${endpoint}`;
  const headers: Record<string, string> = {};
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  return NutriaRetryRequest<T>(
    url,
    {
      method: "POST",
      body: JSON.stringify(body),
      headers,
    },
    config,
  );
};

/**
 * Unwraps a NutriaResponse, throwing the structured error if unsuccessful.
 * Use this when you want the raw data and prefer exceptions over result types.
 */
export function unwrap<T>(response: NutriaResponse<T>): T {
  if (!response.success) {
    const err = new Error(response.error.message) as Error & { statusCode?: number; isRetryable?: boolean };
    err.statusCode = response.error.statusCode;
    err.isRetryable = response.error.isRetryable;
    throw err;
  }
  return response.data;
}

const getRequest = <T>(
  endpoint: string,
  config: ClientConfig,
  authToken?: string,
  params?: Record<string, string>,
): Promise<NutriaResponse<T>> => {
  const search = params ? `?${new URLSearchParams(params)}` : "";
  const url = `${config.baseUrl}${endpoint}${search}`;
  const headers: Record<string, string> = {};
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
  return NutriaRetryRequest<T>(url, { method: "GET", headers }, config);
};

export const api = {
  post: postRequest,
  get: getRequest,
  unwrap,
  postUnwrap: async <T>(
    endpoint: string,
    body: unknown,
    config: ClientConfig,
    authToken?: string,
  ): Promise<T> => unwrap(await postRequest<T>(endpoint, body, config, authToken)),
  getUnwrap: async <T>(
    endpoint: string,
    config: ClientConfig,
    authToken?: string,
    params?: Record<string, string>,
  ): Promise<T> => unwrap(await getRequest<T>(endpoint, config, authToken, params)),
};

// ============================================
// API PÚBLICA - Funções principais
// ============================================

export const searchFoods = async (
  request: SearchFoodsRequest,
  config: ClientConfig = defaultConfig,
  authToken?: string,
): Promise<NutriaResponse<SearchFoodsResponse>> => {
  logger.info(`[CatalogClient] Buscando alimentos: "${request.query}"`);

  return await postRequest<SearchFoodsResponse>(
    "/api/v1/foods/search",
    {
      query: request.query,
      limit: request.limit ?? 10,
      filters: request.filters ?? {},
    },
    config,
    authToken,
  );
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

  const response = unwrap(await postRequest<SimilarFoodsResponse>(
    "/api/v1/foods/search-by-embedding",
    {
      query: request.query,
      limit: request.limit ?? 10,
      filters: request.filters ?? {},
    },
    config,
    authToken,
  ));

  logger.info(
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

  const response = unwrap(await postRequest<CalculateNutritionResponse>(
    "/api/v1/nutrition/calculate",
    { foods },
    config,
    authToken,
  ));

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

  const response = unwrap(await postRequest<SimilarFoodsResponse>(
    "/api/v1/foods/similar",
    {
      food_id: request.food_id,
      limit: request.limit ?? 10,
      same_category: request.same_category ?? false,
      tolerance: request.tolerance ?? 0.3,
    },
    config,
    authToken,
  ));

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

  const response = unwrap(await postRequest<RecommendationResponse>(
    "/api/v1/recommendations",
    {
      user_id: request.user_id,
      limit: request.limit ?? 50,
      ...(request.category && { category: request.category }),
    },
    config,
    authToken,
  ));

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

  const response = unwrap(await postRequest<MealLogResponse>(
    "/api/v1/tracking/meals/log",
    request,
    config,
    authToken,
  ));

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
  const data = await api.getUnwrap<DailySummaryResponse>(
    "/api/v1/tracking/summary/daily",
    config,
    authToken,
    date ? { target_date: date } : undefined,
  );
  console.log(`✅ [CatalogClient] Resumo obtido: ${data.num_meals} refeições`);
  return data;
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
  console.log(`📊 [CatalogClient] Obtendo estatísticas de ${days} dias para ${userId}`);
  const data = await api.getUnwrap<WeeklyStatsResponse>(
    "/api/v1/tracking/stats/weekly",
    config,
    authToken,
    { days: days.toString() },
  );
  console.log(`✅ [CatalogClient] Estatísticas obtidas: ${data.stats.length} dias`);
  return data;
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

  const response = unwrap(await postRequest<MealPlan>(
    `/api/v1/meal-plans`,
    request,
    config,
    authToken,
  ));

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
  console.log(`📋 [CatalogClient] Listando planos alimentares para usuário: ${userId}`);
  const data = await api.getUnwrap<MealPlanListResponse>(
    "/api/v1/meal-plans",
    config,
    authToken,
    { page: page.toString(), page_size: pageSize.toString() },
  );
  console.log(`✅ [CatalogClient] Encontrados ${data.total} planos alimentares`);
  return data;
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
  const data = await api.getUnwrap<MealPlan>(`/api/v1/meal-plans/${planId}`, config, authToken);
  console.log(`✅ [CatalogClient] Plano obtido: "${data.plan_name}"`);
  return data;
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

  const result = await NutriaRequest<MealPlan>(
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

  const result = await NutriaRequest<void>(
    url,
    { method: "DELETE", headers },
    config.timeout,
  );

  if (!result.success) {
    throw new Error(result.error.message);
  }

  console.log(`✅ [CatalogClient] Plano deletado`);
};

export const createUserProfile = async (
  request: CreateUserProfileRequest,
  config = defaultConfig,
  authToken?: string,
): Promise<UserProfile> => {
  console.log(
    `👤 [CatalogClient] Criando perfil para usuário: ${request.user_id}`,
  );

  const response = unwrap(await postRequest<UserProfile>(
    "/api/v1/users/profiles",
    request,
    config,
    authToken,
  ));

  console.log(`✅ [CatalogClient] Perfil criado: ${response.user_id}`);

  return response;
};

export const updateUserProfile = async (
  request: UpdateUserProfileRequest,
  config = defaultConfig,
  authToken?: string,
): Promise<UserProfile> => {
  console.log(`✏️ [CatalogClient] Atualizando perfil do usuário`);

  const url = `${config.baseUrl}/api/v1/users/profiles/me`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  const result = await NutriaRequest<UserProfile>(
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

  const response = unwrap(await postRequest<ImageAnalysisResponse>(
    "/api/v1/foods/analyze",
    request,
    config,
    authToken,
  ));

  console.log(
    `✅ [CatalogClient] DETIC: ${response.total_detected} alimento(s) detectado(s)`,
  );

  return response;
};

// ============================================
// RECIPE TYPES
// ============================================

export interface Recipe {
  id: string;
  name: string;
  description: string;
  category: string;
  prep_time_minutes: number;
  difficulty: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  ingredients?: string[];
  instructions?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SearchRecipesRequest {
  query?: string;
  category?: string;
  difficulty?: string;
  max_prep_time?: number;
  max_calories?: number;
  min_protein?: number;
  limit?: number;
  offset?: number;
}

export interface SearchRecipesResponse {
  success: boolean;
  recipes: Recipe[];
  total: number;
  limit: number;
  offset: number;
}

export interface GetRecipeResponse {
  success: boolean;
  recipe: Recipe;
}

// ============================================
// RECIPE FUNCTIONS
// ============================================

/**
 * Busca receitas por filtros
 *
 * @example
 * const result = await searchRecipes({
 *   category: 'cafe-da-manha',
 *   max_calories: 300,
 *   difficulty: 'facil'
 * });
 */
export const searchRecipes = async (
  request: SearchRecipesRequest,
  config = defaultConfig,
  authToken?: string,
): Promise<SearchRecipesResponse> => {
  console.log(
    `🔍 [CatalogClient] Buscando receitas (query: "${request.query || 'N/A'}")`,
  );

  const response = unwrap(await postRequest<SearchRecipesResponse>(
    "/api/v1/recipes/search",
    {
      query: request.query,
      category: request.category,
      difficulty: request.difficulty,
      max_prep_time: request.max_prep_time,
      max_calories: request.max_calories,
      min_protein: request.min_protein,
      limit: request.limit ?? 20,
      offset: request.offset ?? 0,
    },
    config,
    authToken,
  ));

  console.log(`✅ [CatalogClient] Encontradas ${response.total} receitas`);

  return response;
};

/**
 * Obtém uma receita específica por ID
 *
 * @example
 * const result = await getRecipe('uuid-here');
 */
export const getRecipe = async (
  recipeId: string,
  config = defaultConfig,
  authToken?: string,
): Promise<Recipe> => {
  console.log(`📖 [CatalogClient] Obtendo receita: ${recipeId}`);
  const data = await api.getUnwrap<Recipe>(`/api/v1/recipes/${recipeId}`, config, authToken);
  console.log(`✅ [CatalogClient] Receita obtida: "${data.name}"`);
  return data;
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

// ============================================
// ACTIVITIES
// ============================================

export interface AddActivityRequest {
  type: string;
  duration_minutes: number;
  calories_burned: number;
  date: string;
  notes?: string;
}

export interface ActivityResponse {
  id: string;
  type: string;
  duration_minutes: number;
  calories_burned: number;
  date: string;
}

export const addActivity = (
  request: AddActivityRequest,
  config: ClientConfig = defaultConfig,
  authToken?: string,
): Promise<NutriaResponse<ActivityResponse>> =>
  api.post<ActivityResponse>("/api/v1/activities", request, config, authToken);

// ============================================
// GOALS
// ============================================

export interface AddGoalRequest {
  title: string;
  description?: string;
  target_value: number;
  current_value: number;
  unit: string;
  category: string;
  deadline?: string;
}

export interface GoalResponse {
  id: string;
  title: string;
  target_value: number;
  current_value: number;
  unit: string;
}

export const addGoal = (
  request: AddGoalRequest,
  config: ClientConfig = defaultConfig,
  authToken?: string,
): Promise<NutriaResponse<GoalResponse>> =>
  api.post<GoalResponse>("/api/v1/goals", request, config, authToken);

// ============================================
// NUTRITION / MACROS
// ============================================

export interface MacrosRequest {
  weight_kg: number;
  height_cm: number;
  age: number;
  gender: string;
  activity_level: string;
  diet_goal: string;
}

export interface MacrosResponse {
  tmb: number;
  tdee: number;
  daily_calories: number;
  daily_protein_g: number;
  daily_carbs_g: number;
  daily_fat_g: number;
  calorie_adjustment: number;
  diet_goal: string;
  profile_used: {
    weight_kg: number;
    height_cm: number;
    age: number;
    gender: string;
    activity_level: string;
    diet_goal: string;
  };
  explanation: string;
}

export const calculateMacros = (
  request: MacrosRequest,
  config: ClientConfig = defaultConfig,
  authToken?: string,
): Promise<NutriaResponse<MacrosResponse>> =>
  api.post<MacrosResponse>("/api/v1/nutrition/macros", request, config, authToken);

// ============================================
// RECIPES (save)
// ============================================

export interface SaveRecipeRequest {
  name: string;
  description: string;
  category: string;
  prep_time_minutes: number;
  difficulty: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  ingredients: string[];
  instructions?: string;
}

export const saveRecipe = (
  request: SaveRecipeRequest,
  config: ClientConfig = defaultConfig,
  authToken?: string,
): Promise<NutriaResponse<Recipe>> =>
  api.post<Recipe>("/api/v1/recipes", request, config, authToken);

