import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockExecutionContext } from "./helpers";

// Mock the catalog-client module before importing the tool
vi.mock("../../src/mastra/clients/catalog-client", () => ({
  getWeeklyStats: vi.fn(),
}));

import { getWeeklyStatsTool } from "../../src/mastra/tools/get-weekly-stats";
import { getWeeklyStats } from "../../src/mastra/clients/catalog-client";

const mockedGetWeeklyStats = vi.mocked(getWeeklyStats);

describe("getWeeklyStatsTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns mapped weekly stats on success", async () => {
    const mockResponse = {
      user_id: "user-abc",
      stats: [
        {
          date: "2025-01-20",
          total_calories: 1800,
          total_protein_g: 120,
          total_carbs_g: 220,
          total_fat_g: 60,
          num_meals: 3,
          target_calories: 2000,
          target_protein_g: 150,
        },
        {
          date: "2025-01-21",
          total_calories: 2100,
          total_protein_g: 140,
          total_carbs_g: 250,
          total_fat_g: 70,
          num_meals: 4,
          target_calories: 2000,
          target_protein_g: 150,
        },
      ],
      averages: { calories: 1950, protein_g: 130, carbs_g: 235, fat_g: 65 },
      adherence_rate: 85.7,
    };

    mockedGetWeeklyStats.mockResolvedValueOnce(mockResponse);

    const ctx = createMockExecutionContext("user-abc", "token-xyz");
    const result = await getWeeklyStatsTool.execute(
      { days: 7 },
      ctx as any,
    );

    expect(mockedGetWeeklyStats).toHaveBeenCalledWith(
      "user-abc",
      7,
      undefined,
      "token-xyz",
    );

    expect(result).toEqual({
      user_id: "user-abc",
      num_days: 2,
      averages: { calories: 1950, protein_g: 130, carbs_g: 235, fat_g: 65 },
      adherence_rate: 85.7,
      stats: [
        {
          date: "2025-01-20",
          total_calories: 1800,
          total_protein_g: 120,
          total_carbs_g: 220,
          total_fat_g: 60,
          num_meals: 3,
        },
        {
          date: "2025-01-21",
          total_calories: 2100,
          total_protein_g: 140,
          total_carbs_g: 250,
          total_fat_g: 70,
          num_meals: 4,
        },
      ],
    });
  });

  it("returns fallback object on error", async () => {
    mockedGetWeeklyStats.mockRejectedValueOnce(new Error("API down"));

    const ctx = createMockExecutionContext("user-abc");
    const result = await getWeeklyStatsTool.execute(
      { days: 7 },
      ctx as any,
    );

    expect(result).toEqual({
      user_id: "user-abc",
      num_days: 0,
      averages: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
      adherence_rate: 0,
      stats: [],
    });
  });

  it("handles non-Error thrown values", async () => {
    mockedGetWeeklyStats.mockRejectedValueOnce("string error");

    const ctx = createMockExecutionContext("user-456");
    const result = await getWeeklyStatsTool.execute(
      { days: 14 },
      ctx as any,
    );

    expect(result).toEqual({
      user_id: "user-456",
      num_days: 0,
      averages: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
      adherence_rate: 0,
      stats: [],
    });
  });

  it("uses default days value", async () => {
    mockedGetWeeklyStats.mockRejectedValueOnce(new Error("fail"));

    const ctx = createMockExecutionContext("user-abc", "tk");
    const result = await getWeeklyStatsTool.execute(
      {},
      ctx as any,
    );

    // The default value of days is 7 from the zod schema
    expect(mockedGetWeeklyStats).toHaveBeenCalledWith(
      "user-abc",
      7,
      undefined,
      "tk",
    );
    expect(result.num_days).toBe(0);
  });
});
