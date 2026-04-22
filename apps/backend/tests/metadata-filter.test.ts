import { describe, it, expect } from "vitest";
import { filterByMetadata } from "../src/mastra/config/metadata-filter";
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

const food = (name: string, category?: string) => ({ name, category: category ?? null });

describe("filterByMetadata", () => {
  it("returns all foods when userProfile is null", () => {
    const foods = [food("Arroz"), food("Feijão")];
    const { filtered, removed } = filterByMetadata(foods, null);
    expect(filtered).toHaveLength(2);
    expect(removed).toHaveLength(0);
  });

  it("returns all foods when no restrictions or allergies", () => {
    const foods = [food("Arroz"), food("Feijão")];
    const { filtered, removed } = filterByMetadata(foods, baseProfile);
    expect(filtered).toHaveLength(2);
    expect(removed).toHaveLength(0);
  });

  it("filters banned food for 'vegetariano' restriction", () => {
    const profile: UserProfile = { ...baseProfile, restrictions: ["vegetariano"] };
    const foods = [food("Frango grelhado", "Carnes"), food("Arroz integral", "Cereais")];
    const { filtered, removed } = filterByMetadata(foods, profile);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe("Arroz integral");
    expect(removed[0].name).toBe("Frango grelhado");
  });

  it("filters banned food for 'vegano' restriction", () => {
    const profile: UserProfile = { ...baseProfile, restrictions: ["vegano"] };
    const foods = [food("Iogurte natural", "Laticínios"), food("Tofu", "Proteínas")];
    const { filtered, removed } = filterByMetadata(foods, profile);
    expect(filtered[0].name).toBe("Tofu");
    expect(removed[0].name).toBe("Iogurte natural");
  });

  it("filters banned food for 'sem glúten' restriction", () => {
    const profile: UserProfile = { ...baseProfile, restrictions: ["sem glúten"] };
    const foods = [food("Pão de trigo", "Panificados"), food("Batata doce", "Tubérculos")];
    const { filtered, removed } = filterByMetadata(foods, profile);
    expect(filtered[0].name).toBe("Batata doce");
    expect(removed[0].name).toBe("Pão de trigo");
  });

  it("filters banned food for 'sem lactose' restriction", () => {
    const profile: UserProfile = { ...baseProfile, restrictions: ["sem lactose"] };
    const foods = [food("Queijo prato", "Laticínios"), food("Peito de frango", "Carnes")];
    const { filtered, removed } = filterByMetadata(foods, profile);
    expect(filtered[0].name).toBe("Peito de frango");
    expect(removed[0].name).toBe("Queijo prato");
  });

  it("filters by allergy direct match", () => {
    const profile: UserProfile = { ...baseProfile, allergies: ["amendoim"] };
    const foods = [food("Pasta de amendoim", "Pastas"), food("Maçã", "Frutas")];
    const { filtered, removed } = filterByMetadata(foods, profile);
    expect(filtered[0].name).toBe("Maçã");
    expect(removed[0].name).toBe("Pasta de amendoim");
  });

  it("stores removal reason in reasons map", () => {
    const profile: UserProfile = { ...baseProfile, restrictions: ["vegetariano"] };
    const foods = [food("Carne bovina", "Carnes"), food("Arroz integral", "Cereais")];
    const { reasons } = filterByMetadata(foods, profile);
    expect(reasons.has("Carne bovina")).toBe(true);
    expect(reasons.get("Carne bovina")).toContain("vegetariano");
  });

  it("returns all foods with warning when all would be removed (additive rule)", () => {
    const profile: UserProfile = { ...baseProfile, restrictions: ["vegetariano"] };
    const foods = [food("Frango", "Carnes"), food("Peixe", "Peixes")];
    const { filtered, removed, allRemovedWarning } = filterByMetadata(foods, profile);
    // Additive: should not return empty set
    expect(filtered).toHaveLength(2);
    expect(removed).toHaveLength(0);
    expect(allRemovedWarning).toBeDefined();
    expect(allRemovedWarning).toContain("restrições alimentares");
  });

  it("handles multiple restrictions simultaneously", () => {
    const profile: UserProfile = {
      ...baseProfile,
      restrictions: ["vegetariano", "sem lactose"],
    };
    const foods = [
      food("Frango", "Carnes"),       // removed by vegetariano
      food("Queijo", "Laticínios"),   // removed by sem lactose
      food("Arroz", "Cereais"),        // safe
    ];
    const { filtered, removed } = filterByMetadata(foods, profile);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe("Arroz");
    expect(removed).toHaveLength(2);
  });

  it("is case-insensitive in matching", () => {
    const profile: UserProfile = { ...baseProfile, restrictions: ["vegetariano"] };
    const foods = [food("FRANGO GRELHADO", "Carnes"), food("Arroz", "Cereais")];
    const { removed } = filterByMetadata(foods, profile);
    expect(removed).toHaveLength(1);
    expect(removed[0].name).toBe("FRANGO GRELHADO");
  });
});
