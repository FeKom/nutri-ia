import z from 'zod';

const nutritionSchema = z.object({
  calories: z.number(),
  protein_g: z.number(),
  carbs_g: z.number(),
  fat_g: z.number()
});
const nutritionWithFiber = nutritionSchema.extend({
  fiber_g: z.number()
});

const foodBaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string()
});
const foodWithNutritionSchema = foodBaseSchema.extend({
  nutrition: nutritionSchema
});
const foodWithPortionSchema = foodWithNutritionSchema.extend({
  portion: z.string()
});
const similarFoodSchema = foodBaseSchema.extend({
  nutrition: nutritionWithFiber,
  similarity_score: z.number(),
  similarity_percent: z.number()
});
const recommendedFoodSchema = foodBaseSchema.extend({
  portion: z.string(),
  nutrition: nutritionSchema,
  source: z.string(),
  is_verified: z.boolean()
});

const baseOutputSchema = z.object({
  success: z.boolean(),
  error: z.string().optional()
});
const searchFoodOutputSchema = baseOutputSchema.extend({
  foods: z.array(foodWithPortionSchema),
  count: z.number()
});
const findSimilarOutputSchema = baseOutputSchema.extend({
  referenceFood: foodWithNutritionSchema,
  similarFoods: z.array(similarFoodSchema),
  count: z.number()
});
const nutritionDetailSchema = z.object({
  foodId: z.string(),
  foodName: z.string(),
  quantity_g: z.number(),
  calories: z.number(),
  protein_g: z.number(),
  carbs_g: z.number(),
  fat_g: z.number()
});
const calculateNutritionOutputSchema = baseOutputSchema.extend({
  total: nutritionSchema,
  details: z.array(nutritionDetailSchema)
});
const filtersAppliedSchema = z.object({
  dietary_restrictions: z.array(z.string()),
  allergies: z.array(z.string()),
  disliked_foods: z.array(z.string())
});
const recommendationOutputSchema = baseOutputSchema.extend({
  foods: z.array(recommendedFoodSchema),
  count: z.number(),
  filters_applied: filtersAppliedSchema
});

export { calculateNutritionOutputSchema as c, findSimilarOutputSchema as f, recommendationOutputSchema as r, searchFoodOutputSchema as s };
