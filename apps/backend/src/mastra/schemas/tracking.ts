import z from "zod";

export const mealTypeEnum = z.enum(["breakfast", "lunch", "dinner", "snack"]);

export const trackingSchema = z.object({
  food_id: z.string(),
  quantity_g: z.number(),
  name: z.string().optional(),
});

export const DailyStats = z.object({
  user_id: z.string(),
  date: z.string(),
  total_calories: z.number(),
  total_protein_g: z.number(),
  total_carbs_g: z.number(),
  total_fat_g: z.number(),
  total_fiber_g: z.number().optional(),
  total_sodium_mg: z.number().optional(),

  target_calories: z.number().optional(),
  target_protein_g: z.number().optional(),
  target_carbs_g: z.number().optional(),
  target_fat_g: z.number().optional(),

  num_meals: z.number().optional().default(0),
});

export const MealSumary = z.object({
  id: z.string(),
  mealType: mealTypeEnum,
});

// ========== Meal Log Schemas ==========

export const foodLogItemSchema = z.object({
  food_id: z.string().uuid(),
  quantity_g: z.number().positive(),
  name: z.string().optional(),
});

export const mealLogRequestSchema = z.object({
  user_id: z.string().uuid(),
  meal_type: mealTypeEnum,
  foods: z.array(foodLogItemSchema).min(1),
  consumed_at: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
});

export const mealLogUpdateSchema = z.object({
  meal_type: mealTypeEnum.optional(),
  foods: z.array(foodLogItemSchema).min(1).optional(),
  consumed_at: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
});

export const mealLogResponseSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  consumed_at: z.string(),
  meal_type: mealTypeEnum,
  foods: z.array(z.record(z.any())),
  total_calories: z.number(),
  total_protein_g: z.number(),
  total_carbs_g: z.number(),
  total_fat_g: z.number(),
  total_fiber_g: z.number().optional(),
  total_sodium_mg: z.number().optional(),
  notes: z.string().optional(),
  created_at: z.string(),
});

// ========== Daily Summary Schemas ==========

export const dailySummaryRequestSchema = z.object({
  user_id: z.string().uuid(),
  date: z.string(),
});

export const mealSummarySchema = z.object({
  id: z.string().uuid(),
  meal_type: mealTypeEnum,
  consumed_at: z.string(),
  total_calories: z.number(),
  total_protein_g: z.number(),
  total_carbs_g: z.number(),
  total_fat_g: z.number(),
  num_foods: z.number().int(),
  notes: z.string().optional(),
});

export const nutritionProgressSchema = z.object({
  calories_pct: z.number(),
  protein_pct: z.number(),
  carbs_pct: z.number(),
  fat_pct: z.number(),
});

export const dailySummaryResponseSchema = z.object({
  date: z.string(),
  meals: z.array(mealSummarySchema),
  totals: z.record(z.any()),
  targets: z.record(z.any()),
  progress: nutritionProgressSchema,
  num_meals: z.number().int(),
});

// ========== Weekly Stats Schemas ==========

export const weeklyStatsRequestSchema = z.object({
  user_id: z.string().uuid(),
  days: z.number().int().min(1).max(30).default(7),
});

export const dayStatsSchema = z.object({
  date: z.string(),
  total_calories: z.number(),
  total_protein_g: z.number(),
  total_carbs_g: z.number(),
  total_fat_g: z.number(),
  num_meals: z.number().int(),
  target_calories: z.number().optional(),
  target_protein_g: z.number().optional(),
});

export const weeklyStatsResponseSchema = z.object({
  user_id: z.string().uuid(),
  stats: z.array(dayStatsSchema),
  averages: z.record(z.any()),
  adherence_rate: z.number(),
});
