import z from "zod";
import {
  foodWithNutritionSchema,
  foodWithPortionSchema,
  similarFoodSchema,
  recommendedFoodSchema,
} from "./food";
import { nutritionSchema } from "./nutrition";

export const baseOutputSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
});

export const searchFoodOutputSchema = baseOutputSchema.extend({
  foods: z.array(foodWithPortionSchema),
  count: z.number(),
});

export const findSimilarOutputSchema = baseOutputSchema.extend({
  referenceFood: foodWithNutritionSchema,
  similarFoods: z.array(similarFoodSchema),
  count: z.number(),
});

export const nutritionDetailSchema = z.object({
  foodId: z.string(),
  foodName: z.string(),
  quantity_g: z.number(),
  calories: z.number(),
  protein_g: z.number(),
  carbs_g: z.number(),
  fat_g: z.number(),
});

export const calculateNutritionOutputSchema = baseOutputSchema.extend({
  total: nutritionSchema,
  details: z.array(nutritionDetailSchema),
});

export const filtersAppliedSchema = z.object({
  dietary_restrictions: z.array(z.string()),
  allergies: z.array(z.string()),
  disliked_foods: z.array(z.string()),
});

export const recommendationOutputSchema = baseOutputSchema.extend({
  foods: z.array(recommendedFoodSchema),
  count: z.number(),
  filters_applied: filtersAppliedSchema,
});
