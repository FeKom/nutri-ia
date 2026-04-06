import { api, defaultConfig } from "../clients/catalog-client";
import type { ClientConfig, NutriaResponse } from "../clients/catalog-client";

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
