import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { saveRecipe } from "../api/recipes";
import { unwrap } from "../clients/catalog-client";
import { logger } from "../../utils/logger";

export const suggestRecipeTool = createTool({
  id: "save_recipe",
  description:
    "Salva uma receita no catálogo após o usuário confirmar que quer guardá-la. " +
    "Use APENAS depois de perguntar 'Quer que eu salve essa receita?' e o usuário confirmar. " +
    "Nunca salve sem confirmação explícita.",
  inputSchema: z.object({
    name: z.string().describe("Nome da receita"),
    description: z.string().describe("Descrição breve"),
    category: z
      .enum(["cafe-da-manha", "almoco", "jantar", "lanche"])
      .describe("Categoria da refeição"),
    prep_time_minutes: z.number().int().positive().describe("Tempo de preparo em minutos"),
    difficulty: z.enum(["facil", "medio", "dificil"]).describe("Dificuldade"),
    calories: z.number().int().nonnegative().describe("Calorias por porção"),
    protein_g: z.number().nonnegative().describe("Proteína em gramas"),
    carbs_g: z.number().nonnegative().describe("Carboidratos em gramas"),
    fat_g: z.number().nonnegative().describe("Gordura em gramas"),
    ingredients: z.array(z.string()).min(1).describe("Lista de ingredientes"),
    instructions: z.string().optional().describe("Modo de preparo"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    recipe_id: z.string().optional(),
    message: z.string(),
  }),
  execute: async (input) => {
    logger.info(`🍽️ [Tool:saveRecipe] Salvando receita: ${input.name}`);

    try {
      const recipe = unwrap(await saveRecipe(input));
      logger.info(`✅ [Tool:saveRecipe] Receita salva: ${recipe.id}`);
      return { success: true, recipe_id: recipe.id, message: `Receita "${input.name}" salva com sucesso!` };
    } catch (error) {
      logger.error(`❌ [Tool:saveRecipe] ${error}`);
      return { success: false, message: `Erro ao salvar receita: ${error instanceof Error ? error.message : error}` };
    }
  },
});
