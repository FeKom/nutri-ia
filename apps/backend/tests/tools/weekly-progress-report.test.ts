import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockExecutionContext } from "./helpers";

// Mock the workflow before importing the tool
const mockStart = vi.fn();

vi.mock("../../src/mastra/workflows/weekly-progress-report", () => ({
  weeklyProgressReportWorkflow: {
    createRun: vi.fn(() => Promise.resolve({ start: mockStart })),
  },
}));

import { weeklyProgressReportTool } from "../../src/mastra/tools/weekly-progress-report";

const today = {
  date: "2026-04-24",
  totals: { calories: 1200, protein_g: 80, carbs_g: 140, fat_g: 40 },
  targets: { calories: 2000, protein_g: 150, carbs_g: 220, fat_g: 65 },
  progress: { calories_pct: 60, protein_pct: 53, carbs_pct: 63, fat_pct: 61 },
  num_meals: 2,
};

const baseReportResult = {
  period_days: 7,
  adherence_rate: 0.857,
  averages: { calories: 1850, protein_g: 120, carbs_g: 210, fat_g: 58 },
  stats: [
    {
      date: "2026-04-17",
      total_calories: 1900,
      total_protein_g: 125,
      total_carbs_g: 215,
      total_fat_g: 60,
      num_meals: 3,
    },
  ],
  today,
  weakest_nutrient: "protein",
  recommendations: [
    {
      id: "food-001",
      name: "Frango grelhado",
      category: "protein",
      nutrition: {
        calories_per_100g: 165,
        protein_g: 31,
        carbs_g: 0,
        fat_g: 3.6,
      },
    },
  ],
  message: "Relatório dos últimos 7 dia(s): aderência 86%.",
};

const successWorkflowResult = {
  status: "success" as const,
  result: baseReportResult,
};

describe("weeklyProgressReportTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const exec = (input: any, ctx: any) =>
    (weeklyProgressReportTool.execute as Function)(input, ctx);

  it("throws for anonymous users", async () => {
    const ctx = createMockExecutionContext("anonymous", "");

    await expect(exec({ days: 7 }, ctx)).rejects.toThrow("não autenticado");
  });

  it("returns full report on workflow success", async () => {
    mockStart.mockResolvedValueOnce(successWorkflowResult);

    const ctx = createMockExecutionContext("user-abc", "token-xyz");
    const result = await exec({ days: 7 }, ctx);

    expect(result.period_days).toBe(7);
    expect(result.adherence_rate).toBe(0.857);
    expect(result.weakest_nutrient).toBe("protein");
    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].name).toBe("Frango grelhado");
    expect(result.today).not.toBeNull();
    expect(result.today?.num_meals).toBe(2);
  });

  it("passes correct data to the workflow", async () => {
    mockStart.mockResolvedValueOnce(successWorkflowResult);

    const ctx = createMockExecutionContext("user-abc", "token-xyz");
    await exec({ days: 14 }, ctx);

    expect(mockStart).toHaveBeenCalledWith({
      inputData: {
        days: 14,
        userId: "user-abc",
        authToken: "token-xyz",
      },
    });
  });

  it("uses default of 7 days when not specified", async () => {
    mockStart.mockResolvedValueOnce(successWorkflowResult);

    const ctx = createMockExecutionContext("user-abc", "tk");
    await exec({}, ctx);

    expect(mockStart).toHaveBeenCalledWith({
      inputData: expect.objectContaining({ days: 7 }),
    });
  });

  it("handles null today gracefully", async () => {
    mockStart.mockResolvedValueOnce({
      status: "success" as const,
      result: { ...baseReportResult, today: null },
    });

    const ctx = createMockExecutionContext("user-abc", "token-xyz");
    const result = await exec({ days: 7 }, ctx);

    expect(result.today).toBeNull();
    expect(result.averages.calories).toBe(1850);
  });

  it("throws when workflow status is not success", async () => {
    mockStart.mockResolvedValueOnce({
      status: "failed",
      error: "catalog unreachable",
    });

    const ctx = createMockExecutionContext("user-abc", "token-xyz");

    await expect(exec({ days: 7 }, ctx)).rejects.toThrow("catalog unreachable");
  });

  it("throws with fallback message on unknown workflow error", async () => {
    mockStart.mockResolvedValueOnce({ status: "failed" });

    const ctx = createMockExecutionContext("user-abc", "token-xyz");

    await expect(exec({ days: 7 }, ctx)).rejects.toThrow("Erro desconhecido no workflow");
  });

  it("maps averages and stats correctly", async () => {
    mockStart.mockResolvedValueOnce(successWorkflowResult);

    const ctx = createMockExecutionContext("user-abc", "token-xyz");
    const result = await exec({ days: 7 }, ctx);

    expect(result.averages).toEqual({
      calories: 1850,
      protein_g: 120,
      carbs_g: 210,
      fat_g: 58,
    });
    expect(result.stats).toHaveLength(1);
    expect(result.stats[0].date).toBe("2026-04-17");
  });
});
