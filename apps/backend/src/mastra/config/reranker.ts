import type { UserProfile } from './memory';

export type RankedFood = { id: string; name: string; score: number; [key: string]: unknown };

type FoodInput = { id: string; name: string; similarity_score: number; [key: string]: unknown };

/**
 * Maps restriction keywords to food name/category patterns that should be penalized.
 * Falls back to checking if the restriction word itself appears in the food name/category.
 */
const RESTRICTION_PATTERNS: Record<string, string[]> = {
  lactose: ['leite', 'queijo', 'iogurte', 'manteiga', 'creme de leite', 'nata', 'requeijão', 'milk', 'cheese', 'yogurt', 'butter', 'cream', 'dairy', 'lacticínio'],
  gluten: ['trigo', 'aveia', 'cevada', 'centeio', 'farinha', 'pão', 'macarrão', 'biscoito', 'bolo', 'wheat', 'bread', 'pasta', 'cake', 'cookie', 'cereal'],
  vegetariano: ['frango', 'carne', 'peixe', 'atum', 'sardinha', 'camarão', 'bacon', 'linguiça', 'presunto', 'chicken', 'beef', 'pork', 'fish', 'tuna'],
  vegano: ['frango', 'carne', 'peixe', 'atum', 'sardinha', 'camarão', 'bacon', 'linguiça', 'presunto', 'leite', 'queijo', 'iogurte', 'manteiga', 'ovo', 'mel', 'chicken', 'beef', 'pork', 'fish', 'egg', 'honey', 'milk', 'cheese'],
};

const toNum = (v: unknown): number => Number(v) || 0;

const containsAny = (text: string, terms: string[]): boolean =>
  terms.some((term) => text.includes(term));

const queryTermOverlapScore = (foodName: string, query: string): number => {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);
  const name = foodName.toLowerCase();
  return words.filter((w) => name.includes(w)).length * 0.1;
};

const restrictionPenalty = (food: RankedFood, restrictions: string[]): number => {
  if (restrictions.length === 0) return 0;
  const target = `${String(food.name)} ${String(food.category ?? '')}`.toLowerCase();
  let penalty = 0;
  for (const restriction of restrictions) {
    const key = restriction.toLowerCase();
    const patterns = RESTRICTION_PATTERNS[key] ?? [key];
    if (containsAny(target, patterns)) {
      penalty -= 0.3;
    }
  }
  return penalty;
};

const goalBonus = (food: RankedFood, goal: UserProfile['goal']): number => {
  if (goal === 'weight_loss') {
    const calories = toNum(food.calorie_per_100g);
    if (calories > 0 && calories < 100) return 0.1;
    if (calories > 400) return -0.1;
  }
  if (goal === 'weight_gain') {
    const protein = toNum(food.protein_g_100g);
    if (protein > 15) return 0.1;
  }
  return 0;
};

const verificationBonus = (food: RankedFood): number =>
  food.is_verified === true ? 0.05 : 0;

export const rerankFoods = (
  foods: FoodInput[],
  query: string,
  userProfile: UserProfile | null,
): RankedFood[] => {
  const restrictions = userProfile?.restrictions ?? [];
  const allergies = userProfile?.allergies ?? [];
  const allRestrictions = [...restrictions, ...allergies];
  const goal = userProfile?.goal ?? 'maintain';

  return foods
    .map((food) => {
      const ranked: RankedFood = { ...food, score: food.similarity_score };
      const score =
        food.similarity_score +
        queryTermOverlapScore(String(food.name), query) +
        restrictionPenalty(ranked, allRestrictions) +
        goalBonus(ranked, goal) +
        verificationBonus(ranked);
      return { ...ranked, score };
    })
    .sort((a, b) => b.score - a.score);
};
