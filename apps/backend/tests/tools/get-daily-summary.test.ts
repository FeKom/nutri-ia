import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockExecutionContext } from "./helpers";

// Mock the catalog-client module before importing the tool
vi.mock("../../src/mastra/clients/catalog-client", () => ({
  getDailySummary: vi.fn(),
}));

import { getDailySummaryTool } from "../../src/mastra/tools/get-daily-summary";
import { getDailySummary } from "../../src/mastra/clients/catalog-client";

const mockedGetDailySummary = vi.mocked(getDailySummary);

describe("getDailySummaryTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns mapped daily summary on success", async () => {
    const mockResponse = {
      date: "2025-01-27",
      num_meals: 2,
      totals: { calories: 1500, protein_g: 100, carbs_g: 200, fat_g: 50, fiber_g: 20, sodium_mg: 1500 },
      targets: { calories: 2000, protein_g: 150, carbs_g: 250, fat_g: 70 },
      progress: { calories_pct: 75, protein_pct: 66.7, carbs_pct: 80, fat_pct: 71.4 },
      meals: [
        {
          id: "meal-1",
          meal_type: "breakfast",
          consumed_at: "2025-01-27T08:00:00Z",
          total_calories: 500,
          total_protein_g: 30,
          total_carbs_g: 60,
          total_fat_g: 15,
          num_foods: 3,
        },
        {
          id: "meal-2",
          meal_type: "lunch",
          consumed_at: "2025-01-27T12:00:00Z",
          total_calories: 1000,
          total_protein_g: 70,
          total_carbs_g: 140,
          total_fat_g: 35,
          num_foods: 5,
        },
      ],
    };

    mockedGetDailySummary.mockResolvedValueOnce(mockResponse);

    const ctx = createMockExecutionContext("user-abc", "token-xyz");
    const result = await getDailySummaryTool.execute(
      { date: "2025-01-27" },
      ctx as any,
    );

    expect(mockedGetDailySummary).toHaveBeenCalledWith(
      "user-abc",
      "2025-01-27",
      undefined,
      "token-xyz",
    );

    expect(result).toEqual({
      date: "2025-01-27",
      num_meals: 2,
      totals: { calories: 1500, protein_g: 100, carbs_g: 200, fat_g: 50 },
      targets: { calories: 2000, protein_g: 150, carbs_g: 250, fat_g: 70 },
      progress: { calories_pct: 75, protein_pct: 66.7, carbs_pct: 80, fat_pct: 71.4 },
      meals: [
        {
          id: "meal-1",
          meal_type: "breakfast",
          total_calories: 500,
          total_protein_g: 30,
          total_carbs_g: 60,
          total_fat_g: 15,
        },
        {
          id: "meal-2",
          meal_type: "lunch",
          total_calories: 1000,
          total_protein_g: 70,
          total_carbs_g: 140,
          total_fat_g: 35,
        },
      ],
    });
  });

  it("returns fallback object on error", async () => {
    mockedGetDailySummary.mockRejectedValueOnce(new Error("API down"));

    const ctx = createMockExecutionContext();
    const result = await getDailySummaryTool.execute(
      { date: "2025-01-27" },
      ctx as any,
    );

    expect(result).toEqual({
      date: "2025-01-27",
      num_meals: 0,
      totals: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
      targets: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
      progress: { calories_pct: 0, protein_pct: 0, carbs_pct: 0, fat_pct: 0 },
      meals: [],
    });
  });

  it("uses today's date in fallback when date is not provided", async () => {
    mockedGetDailySummary.mockRejectedValueOnce(new Error("timeout"));

    const ctx = createMockExecutionContext();
    const result = await getDailySummaryTool.execute(
      {},
      ctx as any,
    );

    const today = new Date().toISOString().split("T")[0];
    expect(result.date).toBe(today);
    expect(result.num_meals).toBe(0);
    expect(result.meals).toEqual([]);
  });

  it("handles non-Error thrown values", async () => {
    mockedGetDailySummary.mockRejectedValueOnce("string error");

    const ctx = createMockExecutionContext();
    const result = await getDailySummaryTool.execute(
      { date: "2025-01-27" },
      ctx as any,
    );

    expect(result.num_meals).toBe(0);
    expect(result.meals).toEqual([]);
  });
});
