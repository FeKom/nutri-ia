import z from "zod";

export const recipeSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  preparationTime: z.number(),
  difficulty: z.enum(["easy", "medium", "hard"]),
  calories: z.number(),
  protein_g: z.number(),
  carbs_g: z.number(),
  fat_g: z.number(),
  ingredients: z.array(z.string()),
  instructions: z.string().optional(),
});
