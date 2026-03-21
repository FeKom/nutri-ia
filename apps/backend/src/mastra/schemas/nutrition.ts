import z from "zod";

export const nutritionSchema = z.object({
  calories: z.number(),
  protein_g: z.number(),
  carbs_g: z.number(),
  fat_g: z.number(),
})

export const nutritionWithFiber = nutritionSchema.extend({ 
  fiber_g: z.number(),
 })