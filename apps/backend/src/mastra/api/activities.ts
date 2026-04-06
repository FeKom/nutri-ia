import { api, defaultConfig } from "../clients/catalog-client";
import type { ClientConfig, NutriaResponse } from "../clients/catalog-client";

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
