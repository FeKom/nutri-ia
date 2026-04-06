import { api, defaultConfig } from "../clients/catalog-client";
import type { ClientConfig, NutriaResponse, Recipe } from "../clients/catalog-client";

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
