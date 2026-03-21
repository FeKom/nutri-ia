import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockExecutionContext } from "./helpers";

// Mock the catalog-client module before importing the tool
vi.mock("../../src/mastra/clients/catalog-client", () => ({
  logMeal: vi.fn(),
}));

import { logMealTool } from "../../src/mastra/tools/log-meal";
import { logMeal } from "../../src/mastra/clients/catalog-client";

const mockedLogMeal = vi.mocked(logMeal);

describe("logMealTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const sampleInput = {
    meal_type: "breakfast" as const,
    foods: [
      { food_id: "food-1", quantity_g: 100, name: "Aveia" },
      { food_id: "food-2", quantity_g: 200, name: "Leite" },
    ],
    notes: "Cafe da manha",
  };

  it("returns mapped meal log on success", async () => {
    const mockResponse = {
      id: "log-abc-123",
      user_id: "user-abc",
      consumed_at: "2025-01-27T08:00:00Z",
      meal_type: "breakfast",
      foods: [
        { food_id: "food-1", quantity_g: 100 },
        { food_id: "food-2", quantity_g: 200 },
      ],
      total_calories: 450,
      total_protein_g: 25,
      total_carbs_g: 60,
      total_fat_g: 12,
      total_fiber_g: 5,
      total_sodium_mg: 200,
      notes: "Cafe da manha",
      created_at: "2025-01-27T08:00:00Z",
    };

    mockedLogMeal.mockResolvedValueOnce(mockResponse);

    const ctx = createMockExecutionContext("user-abc", "token-xyz");
    const result = await logMealTool.execute(sampleInput, ctx as any);

    expect(mockedLogMeal).toHaveBeenCalledWith(
      {
        user_id: "user-abc",
        meal_type: "breakfast",
        foods: sampleInput.foods,
        notes: "Cafe da manha",
      },
      undefined,
      "token-xyz",
    );

    expect(result).toEqual({
      id: "log-abc-123",
      total_calories: 450,
      total_protein_g: 25,
      total_carbs_g: 60,
      total_fat_g: 12,
      meal_type: "breakfast",
      num_foods: 2,
    });
  });

  it("returns fallback object on error", async () => {
    mockedLogMeal.mockRejectedValueOnce(new Error("API down"));

    const ctx = createMockExecutionContext();
    const result = await logMealTool.execute(sampleInput, ctx as any);

    expect(result).toEqual({
      id: "",
      total_calories: 0,
      total_protein_g: 0,
      total_carbs_g: 0,
      total_fat_g: 0,
      meal_type: "breakfast",
      num_foods: 0,
    });
  });

  it("preserves meal_type in fallback for different types", async () => {
    mockedLogMeal.mockRejectedValueOnce(new Error("timeout"));

    const ctx = createMockExecutionContext();
    const dinnerInput = {
      meal_type: "dinner" as const,
      foods: [{ food_id: "food-3", quantity_g: 300 }],
    };
    const result = await logMealTool.execute(dinnerInput, ctx as any);

    expect(result.meal_type).toBe("dinner");
    expect(result.id).toBe("");
    expect(result.num_foods).toBe(0);
  });

  it("handles non-Error thrown values", async () => {
    mockedLogMeal.mockRejectedValueOnce(42);

    const ctx = createMockExecutionContext();
    const result = await logMealTool.execute(sampleInput, ctx as any);

    expect(result.id).toBe("");
    expect(result.total_calories).toBe(0);
    expect(result.meal_type).toBe("breakfast");
  });
});
