import { api, defaultConfig } from "../clients/catalog-client";
import type { ClientConfig, NutriaResponse, SearchFoodsRequest, SearchFoodsResponse } from "../clients/catalog-client";

export const searchFoods = async (
  request: SearchFoodsRequest,
  config: ClientConfig = defaultConfig,
  authToken?: string,
): Promise<NutriaResponse<SearchFoodsResponse>> => {
  console.log(`🔍 [CatalogClient] Buscando alimentos: "${request.query}"`);

  return await api.post<SearchFoodsResponse>(
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
