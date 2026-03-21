# Communication: Backend -> Catalog API

Contrato de comunicacao entre o nutria-backend (Mastra/Hono) e o nutria-catalog (FastAPI/Python).

## Arquitetura

```
Frontend (Next.js:3000) -> Backend (Mastra/Hono:4111) -> Catalog API (FastAPI:8000)
```

- **Backend** usa `catalog-client.ts` para se comunicar com o Catalog
- HTTP client funcional com retry, backoff e timeout
- JWT propagado via header `Authorization: Bearer <token>`

## Configuracao do Client

```typescript
// src/mastra/config/env.ts
CATALOG_API_URL: string     // default "http://localhost:8000"
CATALOG_API_TIMEOUT: number // default 5000 (ms)
CATALOG_API_RETRY_ATTEMPTS: number // default 3
CATALOG_API_RETRY_DELAY: number    // default 1000 (ms)
```

Retry: exponential backoff (`delay * 2^(attempt-1)`). Retryable: status 429, 500, 502, 503, 504.

## Client: `src/mastra/clients/catalog-client.ts`

Todas as funcoes aceitam `(request, config?, authToken?)`.

---

## Endpoints da Catalog API

Base URL: `http://localhost:8000`
Prefixo: `/api/v1`

### Foods

#### `POST /api/v1/foods/search`
Busca textual (ILIKE) no catalogo de alimentos.

```typescript
// Request
interface SearchFoodsRequest {
  query: string;        // min 1, max 255 chars
  limit?: number;       // default 10, max 100
  filters?: {
    category?: string;
    min_protein?: number;
    max_calories?: number;
    source?: "usda" | "taco" | "custom";
    verified_only?: boolean;
  };
}

// Response
interface SearchFoodsResponse {
  success: boolean;
  foods: FoodItem[];
  count: number;
}

interface FoodItem {
  id: string;           // UUID
  name: string;
  category: string | null;
  serving_size_g: number;
  serving_unit: string | null;
  calorie_per_100g: number;
  source: string;       // "USDA" | "TACO" | "CUSTOM"
  is_verified: boolean;
  protein_g_100g: number | null;
  carbs_g_100g: number | null;
  fat_g_100g: number | null;
}
```

Client: `searchFoods(request)`

#### `GET /api/v1/foods/{food_id}`
Busca alimento por UUID.

```typescript
// Response: FoodItem (mesmo schema acima)
```

#### `POST /api/v1/foods/search-by-embedding`
Busca semantica via embeddings (pgvector cosine similarity).

```typescript
// Request
interface SearchByEmbeddingRequest {
  query: string;        // texto livre
  limit?: number;       // default 10, max 100
  min_similarity?: number; // 0.0-1.0, default 0.0 - filtra resultados abaixo do threshold
  filters?: SearchFilters;
}

// Response
interface SimilarFoodsResponse {
  success: boolean;
  reference_food: null;  // sempre null neste endpoint
  similar_foods: SimilarFoodItem[];
  count: number;
}

interface SimilarFoodItem {
  id: string;
  name: string;
  category: string | null;
  calorie_per_100g: number | null;
  protein_g_100g: number | null;
  carbs_g_100g: number | null;
  fat_g_100g: number | null;
  fiber_g_100g: number | null;
  similarity_score: number; // 0-1, higher = more similar
  source: string;
  is_verified: boolean;
}
```

Client: `searchFoodsByEmbedding(request)`

#### `POST /api/v1/foods/resolve` (NOVO)
Resolve lista de nomes de alimentos em batch via embeddings. Ideal para quando o agente LLM extrai nomes de alimentos e precisa resolver todos de uma vez.

```typescript
// Request
interface FoodResolveRequest {
  queries: string[];        // lista de nomes, max 50
  min_similarity?: number;  // default 0.4, threshold para considerar match
  limit_per_query?: number; // default 1, top matches por query
}

// Response
interface FoodResolveResponse {
  success: boolean;
  resolved: ResolvedFoodItem[];
  unresolved: string[];     // queries que nao matcharam
  resolved_count: number;
  unresolved_count: number;
}

interface ResolvedFoodItem {
  query: string;            // query original
  food_id: string;          // UUID do alimento no catalogo
  name: string;
  category: string | null;
  calorie_per_100g: number | null;
  protein_g_100g: number | null;
  carbs_g_100g: number | null;
  fat_g_100g: number | null;
  similarity_score: number;
  source: string;
  is_verified: boolean;
}
```

Client: ainda nao implementado - adicionar `resolveFoods(request)` ao catalog-client.ts.

#### `POST /api/v1/foods/similar`
Encontra alimentos similares a um alimento de referencia.

```typescript
// Request
interface SimilarFoodRequest {
  food_id: string;      // UUID do alimento referencia
  limit?: number;       // default 10, max 50
  same_category?: boolean; // default false
}

// Response: SimilarFoodsResponse (mesmo schema de search-by-embedding, mas reference_food preenchido)
```

Client: `findSimilarFoods(request)`

### Nutrition

#### `POST /api/v1/nutrition/calculate`
Calcula valores nutricionais totais para uma lista de alimentos.

```typescript
// Request
interface NutritionCalculationRequest {
  foods: Array<{
    food_id: string;    // UUID
    quantity: number;   // em gramas, > 0
  }>;
}

// Response
interface NutritionCalculationResponse {
  success: boolean;
  total: {
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
  };
  details: Array<{
    food_id: string;
    food_name: string;
    quantity_g: number;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  }>;
}
```

Client: `calculateNutrition(foods)`

### Recommendations

#### `POST /api/v1/recommendations`
Recomendacoes personalizadas baseadas no perfil do usuario.
**Auth:** JWT required (user_id extraido do token).

```typescript
// Request
interface RecommendationRequest {
  category?: string;
  limit?: number;       // default 50
}

// Response
interface RecommendationResponse {
  success: boolean;
  foods: RecommendedFoodItem[];
  count: number;
  filters_applied: {
    dietary_restrictions: string[];
    allergies: string[];
    disliked_foods: string[];
  };
}
```

Client: `getRecommendations(request)`

#### `GET /api/v1/recommendations/filters`
Retorna filtros alimentares do usuario.
**Auth:** JWT required.

```typescript
// Response
interface UserFiltersResponse {
  user_id: string;
  dietary_restrictions: string[];
  allergies: string[];
  disliked_foods: string[];
}
```

### Tracking

Todos os endpoints de tracking requerem JWT.

#### `POST /api/v1/tracking/meals/log`
Registra uma refeicao.

```typescript
// Request
interface LogMealRequest {
  user_id: string;      // overridden pelo JWT
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  foods: Array<{
    food_id: string;
    quantity_g: number;
    name?: string;
  }>;
  consumed_at?: string; // ISO datetime
  notes?: string;
}

// Response
interface MealLogResponse {
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
```

Client: `logMeal(request)`

#### `PUT /api/v1/tracking/meals/{meal_id}`
Atualiza uma refeicao existente. Auth: JWT required, ownership validated.

#### `DELETE /api/v1/tracking/meals/{meal_id}`
Deleta uma refeicao. Auth: JWT required, ownership validated. Status: 204.

#### `GET /api/v1/tracking/summary/daily`
Resumo nutricional do dia.

```typescript
// Query params
target_date?: string; // YYYY-MM-DD, default today

// Response
interface DailySummaryResponse {
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
  progress: {
    calories_pct: number;
    protein_pct: number;
    carbs_pct: number;
    fat_pct: number;
  };
  num_meals: number;
}
```

Client: `getDailySummary(userId, date?)`

#### `GET /api/v1/tracking/stats/weekly`
Estatisticas semanais.

```typescript
// Query params
days?: number; // default 7, min 1, max 30

// Response
interface WeeklyStatsResponse {
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
```

Client: `getWeeklyStats(userId, days?)`

### User Profiles

#### `POST /api/v1/users/profiles`
Cria perfil do usuario. **Auth:** JWT required.

```typescript
// Request
interface UserProfileCreate {
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

// Response: UserProfile
```

Client: `createUserProfile(request)`

#### `GET /api/v1/users/profiles/me`
Perfil do usuario autenticado. **Auth:** JWT required.

#### `PUT /api/v1/users/profiles/me`
Atualiza perfil (partial update). **Auth:** JWT required.

Client: `updateUserProfile(request)`

#### `DELETE /api/v1/users/profiles/me`
Deleta perfil e dados relacionados. **Auth:** JWT required. Status: 204.

#### `GET /api/v1/users/profiles/{user_id}`
Busca perfil por user_id. **Publico** (usado por servicos internos).

### Meal Plans

Todos os endpoints requerem JWT (ownership validated).

#### `POST /api/v1/meal-plans`
Cria plano alimentar.

```typescript
// Request
interface CreateMealPlanRequest {
  plan_name: string;
  description?: string;
  daily_calories: number;
  daily_protein_g: number;
  daily_fat_g: number;
  daily_carbs_g: number;
  created_by?: "user" | "ai";
  meals?: Record<string, unknown>[];
}

// Response
interface MealPlan {
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
```

Client: `createMealPlan(request)`

#### `GET /api/v1/meal-plans`
Lista planos com paginacao.

```typescript
// Query params
page?: number;      // default 1
page_size?: number;  // default 10, max 100

// Response
interface MealPlanListResponse {
  plans: MealPlan[];
  total: number;
  page: number;
  page_size: number;
}
```

Client: `listMealPlans(userId, page?, pageSize?)`

#### `GET /api/v1/meal-plans/{plan_id}`
Busca plano por ID. Client: `getMealPlan(planId, userId)`

#### `PUT /api/v1/meal-plans/{plan_id}`
Atualiza plano. Client: `updateMealPlan(planId, userId, updates)`

#### `DELETE /api/v1/meal-plans/{plan_id}`
Deleta plano. Status: 204. Client: `deleteMealPlan(planId, userId)`

#### `GET /api/v1/meal-plans/{plan_id}/pdf`
Exporta plano como PDF. Response: `application/pdf` streaming.

### Health

#### `GET /`
Info da API.

#### `GET /health`
Health check. Response: `{ status: "healthy", service: string, version: string }`

Client: `healthCheck()`

---

## Padroes do HTTP Client

O `catalog-client.ts` segue padroes funcionais:

1. **Retry automatico**: 3 tentativas com exponential backoff (1s, 2s, 4s)
2. **Timeout**: 5s por request (AbortSignal.timeout)
3. **Auth**: JWT propagado via `Authorization: Bearer <token>` header
4. **Erros**: Status 429/500/502/503/504 sao retryable; network errors tambem

### Como adicionar novo endpoint ao client

```typescript
// 1. Adicionar tipos
export interface NewRequest { ... }
export interface NewResponse { ... }

// 2. Adicionar funcao
export const newFunction = async (
  request: NewRequest,
  config = defaultConfig,
  authToken?: string,
): Promise<NewResponse> => {
  return postRequest<NewResponse>("/api/v1/endpoint", request, config, authToken);
};

// 3. Adicionar ao createClient
export const createClient = (customConfig?) => ({
  ...existing,
  newFunction: (request) => newFunction(request, config),
});
```

## Uso nas Mastra Tools

As tools do agente usam o client diretamente:

```typescript
// src/mastra/tools/search-food-catalog.ts
import { searchFoodsByEmbedding } from "../clients/catalog-client";

// Dentro da tool execute:
const result = await searchFoodsByEmbedding(
  { query: "frango grelhado", limit: 5 },
  undefined,  // usa config default
  authToken,  // JWT do usuario
);
```

O `authToken` vem do `AsyncLocalStorage` configurado no endpoint `/chat`:
```typescript
import { asyncContext } from "../../lib/async-context";
const ctx = asyncContext.getStore();
const authToken = ctx?.jwtToken;
```
