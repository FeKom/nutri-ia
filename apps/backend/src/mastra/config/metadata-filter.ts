import type { UserProfile } from './memory';

type RestrictionRule = { keywords: string[]; bannedPatterns: string[] };

const RESTRICTION_RULES: Record<string, RestrictionRule> = {
  vegetariano: {
    keywords: ['vegetariano', 'veggie'],
    bannedPatterns: ['frango', 'carne', 'peixe', 'atum', 'salmão', 'porco', 'bacon', 'presunto', 'linguiça'],
  },
  vegano: {
    keywords: ['vegano', 'vegan'],
    bannedPatterns: ['leite', 'queijo', 'iogurte', 'ovo', 'mel', 'manteiga', 'creme', 'frango', 'carne', 'peixe'],
  },
  'sem glúten': {
    keywords: ['glúten', 'celíaco', 'celiaco'],
    bannedPatterns: ['trigo', 'centeio', 'cevada', 'aveia', 'farinha', 'pão', 'macarrão', 'massa', 'biscoito'],
  },
  'sem lactose': {
    keywords: ['lactose', 'intolerante'],
    bannedPatterns: ['leite', 'queijo', 'iogurte', 'manteiga', 'creme', 'requeijão', 'ricota', 'mozarela'],
  },
};

const matchesPattern = (text: string, pattern: string): boolean =>
  text.toLowerCase().includes(pattern.toLowerCase());

const foodText = (food: { name: string; category?: string | null }): string =>
  `${food.name} ${food.category ?? ''}`.toLowerCase();

/**
 * Resolves which RESTRICTION_RULES keys apply for a given restriction string.
 * Matches by exact key name or by any keyword in the rule.
 */
const resolveRules = (restriction: string): RestrictionRule[] => {
  const lower = restriction.toLowerCase();
  return Object.entries(RESTRICTION_RULES)
    .filter(([key, rule]) => key === lower || rule.keywords.some((kw) => lower.includes(kw)))
    .map(([, rule]) => rule);
};

type FilterResult<T> = {
  filtered: T[];
  removed: T[];
  reasons: Map<string, string>;
  allRemovedWarning?: string;
};

/**
 * Filters foods based on user dietary restrictions and allergies.
 *
 * - Checks each restriction in userProfile.restrictions against RESTRICTION_RULES
 * - Checks each allergen in userProfile.allergies as a direct substring match
 * - A food is removed if its name or category contains any banned pattern
 * - Additive: if all foods match a restriction, returns all with a warning instead of empty set
 */
export const filterByMetadata = <T extends { name: string; category?: string | null }>(
  foods: T[],
  userProfile: UserProfile | null,
): FilterResult<T> => {
  if (!userProfile || (userProfile.restrictions.length === 0 && userProfile.allergies.length === 0)) {
    return { filtered: foods, removed: [], reasons: new Map() };
  }

  const reasons = new Map<string, string>();
  const removed: T[] = [];
  const filtered: T[] = [];

  for (const food of foods) {
    const text = foodText(food);
    let removalReason: string | null = null;

    // Check restriction rules
    for (const restriction of userProfile.restrictions) {
      if (removalReason) break;
      const rules = resolveRules(restriction);
      for (const rule of rules) {
        const matched = rule.bannedPatterns.find((p) => matchesPattern(text, p));
        if (matched) {
          removalReason = `restrição "${restriction}" (contém "${matched}")`;
          break;
        }
      }
    }

    // Check allergies (direct substring match)
    if (!removalReason) {
      for (const allergen of userProfile.allergies) {
        if (matchesPattern(text, allergen)) {
          removalReason = `alergia a "${allergen}"`;
          break;
        }
      }
    }

    if (removalReason) {
      reasons.set(food.name, removalReason);
      removed.push(food);
    } else {
      filtered.push(food);
    }
  }

  // Additive rule: never return an empty set
  if (filtered.length === 0 && removed.length > 0) {
    return {
      filtered: foods,
      removed: [],
      reasons: new Map(),
      allRemovedWarning:
        'Aviso: todos os alimentos encontrados podem conflitar com restrições alimentares. Exibindo todos os resultados.',
    };
  }

  return { filtered, removed, reasons };
};
