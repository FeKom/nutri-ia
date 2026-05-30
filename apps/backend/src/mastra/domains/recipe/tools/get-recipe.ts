import { withAuth } from '../../../utils/with-auth';
import { z } from 'zod';
import { getRecipe } from '../../../clients/catalog-client';
import { getRecipeOutputSchema } from '../../../schemas/output';
import { logger } from '../../../../utils/logger';

/**
 * Tool para obter detalhes completos de uma receita
 * Inclui lista de ingredientes e instruções de preparo
 */
export const getRecipeTool = withAuth({
  id: 'get-recipe',
  description:
    'Obtém os detalhes completos de uma receita específica, incluindo lista de ingredientes e instruções de preparo passo a passo.',
  inputSchema: z.object({
    recipe_id: z.string().describe('ID da receita (UUID)'),
  }),
  outputSchema: getRecipeOutputSchema,
  execute: async (inputData, { authToken }) => {
    const { recipe_id } = inputData;

    logger.info(`📖 [Tool] Obtendo receita: ${recipe_id}`);

    try {
      const recipe = await getRecipe(recipe_id, undefined, authToken);

      logger.info(`✅ [Tool] Receita obtida: "${recipe.name}"`);

      return {
        success: true,
        recipe,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Erro desconhecido';

      logger.error(`❌ [Tool] Erro ao obter receita: ${errorMessage}`);

      return {
        success: false,
        recipe: null as any, // Will be caught by error field
        error: `Não foi possível obter a receita: ${errorMessage}`,
      };
    }
  },
});
