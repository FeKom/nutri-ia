import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { searchRecipes, type Recipe } from '../clients/catalog-client';
import { searchRecipesOutputSchema } from '../schemas/output';
import { extractAuthContext } from '../utils/auth-context';
import { logger } from '../../utils/logger';

/**
 * Formata receita para output da tool
 */
const formatRecipe = (recipe: Recipe) => ({
  id: recipe.id,
  name: recipe.name,
  description: recipe.description,
  category: recipe.category,
  prep_time_minutes: recipe.prep_time_minutes,
  difficulty: recipe.difficulty,
  calories: recipe.calories,
  protein_g: recipe.protein_g,
  carbs_g: recipe.carbs_g,
  fat_g: recipe.fat_g,
});

/**
 * Tool para buscar receitas com filtros
 * Conecta com a Food Catalog API (FastAPI)
 */
export const searchRecipesTool = createTool({
  id: 'search-recipes',
  description:
    'Busca receitas no catálogo por categoria, dificuldade, tempo de preparo e macronutrientes. Retorna receitas com informações nutricionais.',
  inputSchema: z.object({
    query: z
      .string()
      .optional()
      .describe('Busca textual (nome da receita, ingrediente)'),
    category: z
      .enum(['cafe-da-manha', 'almoco', 'jantar', 'lanche'])
      .optional()
      .describe('Categoria da refeição'),
    difficulty: z
      .enum(['facil', 'medio', 'dificil'])
      .optional()
      .describe('Nível de dificuldade'),
    max_prep_time: z
      .number()
      .optional()
      .describe('Tempo máximo de preparo em minutos'),
    max_calories: z
      .number()
      .optional()
      .describe('Calorias máximas por porção'),
    min_protein: z
      .number()
      .optional()
      .describe('Proteína mínima em gramas'),
    limit: z
      .number()
      .optional()
      .default(10)
      .describe('Número máximo de resultados (padrão: 10)'),
  }),
  outputSchema: searchRecipesOutputSchema,
  execute: async (inputData, executionContext) => {
    const { authToken } = extractAuthContext(executionContext);

    logger.info(
      `🔍 [Tool] Buscando receitas com filtros: ${JSON.stringify(inputData)}`
    );

    try {
      const response = await searchRecipes(inputData, undefined, authToken);

      const recipes = response.recipes.map(formatRecipe);

      logger.info(`✅ [Tool] Encontradas ${recipes.length} receitas`);

      return {
        success: true,
        recipes,
        total: response.total,
        count: recipes.length,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Erro desconhecido';

      logger.error(`❌ [Tool] Erro na busca de receitas: ${errorMessage}`);

      return {
        success: false,
        recipes: [],
        total: 0,
        count: 0,
        error: `Não foi possível buscar receitas: ${errorMessage}`,
      };
    }
  },
});
