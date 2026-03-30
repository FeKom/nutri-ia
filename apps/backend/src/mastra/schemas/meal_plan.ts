import z from "zod";

export const mealPlanCreateSchema = z.object({
  user_id: z.string(),
  plan_name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  daily_calories: z.number().positive(),
  daily_protein_g: z.number().positive(),
  daily_fat_g: z.number().positive(),
  daily_carbs_g: z.number().positive(),
  created_by: z.string().default("user"),
  meals: z.array(z.record(z.any())).default([]),
});

export const mealPlanUpdateSchema = z.object({
  plan_name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  daily_calories: z.number().positive().optional(),
  daily_protein_g: z.number().positive().optional(),
  daily_fat_g: z.number().positive().optional(),
  daily_carbs_g: z.number().positive().optional(),
  meals: z.array(z.record(z.any())).optional(),
});

export const mealPlanResponseSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  plan_name: z.string(),
  description: z.string().optional(),
  daily_calories: z.number(),
  daily_protein_g: z.number(),
  daily_fat_g: z.number(),
  daily_carbs_g: z.number(),
  created_by: z.string(),
  meals: z.array(z.record(z.any())),
  created_at: z.string(),
  updated_at: z.string(),
});

export const mealPlanListResponseSchema = z.object({
  plans: z.array(mealPlanResponseSchema),
  total: z.number().int(),
  page: z.number().int(),
  page_size: z.number().int(),
});

export type CreateMealPlanRequest = z.infer<typeof mealPlanCreateSchema>;
export type UpdateMealPlanRequest = z.infer<typeof mealPlanUpdateSchema>;
export type MealPlan = z.infer<typeof mealPlanResponseSchema>;
export type MealPlanListResponse = z.infer<typeof mealPlanListResponseSchema>;
