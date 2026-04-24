import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockExecutionContext } from "./helpers";

// Mock the workflow before importing the tool
const mockStart = vi.fn();

vi.mock("../../src/mastra/workflows/log-image-meal", () => ({
  logImageMealWorkflow: {
    createRun: vi.fn(() => Promise.resolve({ start: mockStart })),
  },
}));

import { logImageMealTool } from "../../src/mastra/tools/log-image-meal";

const BASE64_IMAGE = "data:image/jpeg;base64," + "A".repeat(200);

const sampleInput = {
  image_base64: BASE64_IMAGE,
  meal_type: "lunch" as const,
  notes: "Almoço",
};

const successWorkflowResult = {
  status: "success" as const,
  result: {
    meal_log_id: "log-abc-123",
    meal_type: "lunch",
    total_calories: 620,
    total_protein_g: 42,
    total_carbs_g: 75,
    total_fat_g: 18,
    foods_logged: 3,
    catalog_matches_used: [
      {
        detected_name: "rice",
        catalog_food_name: "Arroz branco cozido",
        similarity: 0.92,
        quantity_g: 150,
      },
    ],
    message: "Refeição registrada com 3 alimento(s). Total: 620 kcal.",
  },
};

describe("logImageMealTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const exec = (input: any, ctx: any) =>
    (logImageMealTool.execute as Function)(input, ctx);

  it("throws for anonymous users", async () => {
    const ctx = createMockExecutionContext("anonymous", "");

    await expect(exec(sampleInput, ctx)).rejects.toThrow("não autenticado");
  });

  it("returns mapped meal log on workflow success", async () => {
    mockStart.mockResolvedValueOnce(successWorkflowResult);

    const ctx = createMockExecutionContext("user-abc", "token-xyz");
    const result = await exec(sampleInput, ctx);

    expect(result).toEqual({
      meal_log_id: "log-abc-123",
      meal_type: "lunch",
      total_calories: 620,
      total_protein_g: 42,
      total_carbs_g: 75,
      total_fat_g: 18,
      foods_logged: 3,
      message: "Refeição registrada com 3 alimento(s). Total: 620 kcal.",
    });
  });

  it("passes correct data to the workflow", async () => {
    mockStart.mockResolvedValueOnce(successWorkflowResult);

    const ctx = createMockExecutionContext("user-abc", "token-xyz");
    await exec(sampleInput, ctx);

    expect(mockStart).toHaveBeenCalledWith({
      inputData: expect.objectContaining({
        image_base64: BASE64_IMAGE,
        meal_type: "lunch",
        notes: "Almoço",
        userId: "user-abc",
        authToken: "token-xyz",
        top_k_per_food: 3,
        confidence_threshold: 0.5,
      }),
    });
  });

  it("throws when workflow status is not success", async () => {
    mockStart.mockResolvedValueOnce({
      status: "failed",
      error: "DETIC service unavailable",
    });

    const ctx = createMockExecutionContext("user-abc", "token-xyz");

    await expect(exec(sampleInput, ctx)).rejects.toThrow("DETIC service unavailable");
  });

  it("throws when workflow status is failed with unknown error", async () => {
    mockStart.mockResolvedValueOnce({ status: "failed" });

    const ctx = createMockExecutionContext("user-abc", "token-xyz");

    await expect(exec(sampleInput, ctx)).rejects.toThrow("Erro desconhecido no workflow");
  });

  it("works without optional notes field", async () => {
    mockStart.mockResolvedValueOnce(successWorkflowResult);

    const ctx = createMockExecutionContext("user-abc", "token-xyz");
    const inputWithoutNotes = {
      image_base64: BASE64_IMAGE,
      meal_type: "breakfast" as const,
    };

    const result = await exec(inputWithoutNotes, ctx);
    expect(result.meal_log_id).toBe("log-abc-123");

    expect(mockStart).toHaveBeenCalledWith({
      inputData: expect.objectContaining({
        notes: undefined,
        meal_type: "breakfast",
      }),
    });
  });
});
