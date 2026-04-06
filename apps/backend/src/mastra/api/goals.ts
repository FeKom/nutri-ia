import { api, defaultConfig } from "../clients/catalog-client";
import type { ClientConfig, NutriaResponse } from "../clients/catalog-client";

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
