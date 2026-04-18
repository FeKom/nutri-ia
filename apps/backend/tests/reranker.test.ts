import { describe, it, expect } from "vitest";
import { rerankFoods } from "../src/mastra/config/reranker";
import type { UserProfile } from "../src/mastra/config/memory";

const baseProfile: UserProfile = {
  id: "user-1",
  name: "Test",
  allergies: [],
  restrictions: [],
  dislikes: [],
  goal: "maintain",
  activity_level: "moderate",
};

const food = (overrides: object) => ({
  id: "f1",
  name: "Arroz branco",
  similarity_score: 0.8,
  calorie_per_100g: 130,
  protein_g_100g: 2.5,
  is_verified: false,
  category: "Cereais",
  ...overrides,
});

describe("rerankFoods", () => {
  it("returns foods sorted by score descending", () => {
    const foods = [
      food({ id: "f1", name: "Arroz branco", similarity_score: 0.7 }),
      food({ id: "f2", name: "Feijão preto", similarity_score: 0.9 }),
    ];
    const result = rerankFoods(foods, "legume", null);
    expect(result[0].id).toBe("f2");
  });

  it("adds query term overlap bonus", () => {
    const foods = [
      food({ id: "f1", name: "Arroz branco", similarity_score: 0.8 }),
      food({ id: "f2", name: "Arroz integral", similarity_score: 0.8 }),
    ];
    // "integral" appears in f2's name → f2 gets +0.1
    const result = rerankFoods(foods, "arroz integral", null);
    expect(result[0].id).toBe("f2");
  });

  it("applies restriction penalty for lactose", () => {
    const profile: UserProfile = { ...baseProfile, restrictions: ["lactose"] };
    const foods = [
      food({ id: "f1", name: "Queijo minas", similarity_score: 0.9, category: "Laticínios" }),
      food({ id: "f2", name: "Frango grelhado", similarity_score: 0.7, category: "Carnes" }),
    ];
    const result = rerankFoods(foods, "proteína", profile);
    // Queijo has restriction penalty (-0.3), frango does not → frango should rank first
    expect(result[0].id).toBe("f2");
  });

  it("applies weight_loss goal bonus for low-calorie foods", () => {
    const profile: UserProfile = { ...baseProfile, goal: "weight_loss" };
    const foods = [
      food({ id: "f1", name: "Abobrinha", similarity_score: 0.75, calorie_per_100g: 17 }),
      food({ id: "f2", name: "Arroz branco", similarity_score: 0.75, calorie_per_100g: 130 }),
    ];
    const result = rerankFoods(foods, "legume", profile);
    expect(result[0].id).toBe("f1"); // low cal → +0.1 bonus
  });

  it("applies weight_loss goal penalty for high-calorie foods (>400 kcal)", () => {
    const profile: UserProfile = { ...baseProfile, goal: "weight_loss" };
    const foods = [
      food({ id: "f1", name: "Azeite", similarity_score: 0.8, calorie_per_100g: 884 }),
      food({ id: "f2", name: "Brócolis", similarity_score: 0.8, calorie_per_100g: 34 }),
    ];
    const result = rerankFoods(foods, "saudável", profile);
    expect(result[0].id).toBe("f2");
  });

  it("applies weight_gain goal bonus for high-protein foods", () => {
    const profile: UserProfile = { ...baseProfile, goal: "weight_gain" };
    const foods = [
      food({ id: "f1", name: "Peito de frango", similarity_score: 0.8, protein_g_100g: 25 }),
      food({ id: "f2", name: "Arroz", similarity_score: 0.8, protein_g_100g: 2 }),
    ];
    const result = rerankFoods(foods, "proteína", profile);
    expect(result[0].id).toBe("f1");
  });

  it("adds verification bonus for is_verified foods", () => {
    const foods = [
      food({ id: "f1", name: "Maçã", similarity_score: 0.8, is_verified: true }),
      food({ id: "f2", name: "Pera", similarity_score: 0.8, is_verified: false }),
    ];
    const result = rerankFoods(foods, "fruta", null);
    expect(result[0].id).toBe("f1");
  });

  it("handles empty food list", () => {
    const result = rerankFoods([], "arroz", null);
    expect(result).toEqual([]);
  });

  it("handles null userProfile gracefully", () => {
    const foods = [food({ id: "f1" }), food({ id: "f2", name: "Feijão" })];
    expect(() => rerankFoods(foods, "comida", null)).not.toThrow();
  });

  it("combines multiple bonuses correctly", () => {
    const profile: UserProfile = { ...baseProfile, goal: "weight_loss" };
    const foods = [
      // f1: low cal (+0.1) + verified (+0.05) + name match (+0.1) = +0.25 on top of 0.7 → 0.95
      food({ id: "f1", name: "Abobrinha grelhada", similarity_score: 0.7, calorie_per_100g: 17, is_verified: true }),
      // f2: high base score but penalized by high calories
      food({ id: "f2", name: "Brownie", similarity_score: 0.95, calorie_per_100g: 450, is_verified: false }),
    ];
    const result = rerankFoods(foods, "abobrinha grelhada", profile);
    expect(result[0].id).toBe("f1");
  });
});
