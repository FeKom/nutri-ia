import z from "zod";

export const userProfileSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  name: z.string(),
  age: z.number(),
  weight_kg: z.number().optional(),
  height_cm: z.number().optional(),
  gender: z.string().optional(),
  activity_level: z
    .enum(["sedentary", "light", "moderate", "active", "very_active"])
    .optional(),
  diet_goal: z.enum(["weight_loss", "weight_gain", "maintain"]).optional(),
  dietary_restrictions: z.array(z.string()).optional(),
  allergies: z.array(z.string()).optional(),
  disliked_foods: z.array(z.string()).optional(),
  preferred_cuisines: z.array(z.string()).optional(),
});

export type UserProfile = z.infer<typeof userProfileSchema>;

export const createUserProfileSchema = z.object({
  user_id: z.string(),
  name: z.string(),
  age: z.number(),
  weight_kg: z.number().optional(),
  height_cm: z.number().optional(),
  gender: z.string().optional(),
  activity_level: z.string().optional(),
  diet_goal: z.string().optional(),
  dietary_restrictions: z.array(z.string()).optional(),
  allergies: z.array(z.string()).optional(),
  disliked_foods: z.array(z.string()).optional(),
  preferred_cuisines: z.array(z.string()).optional(),
});

export type CreateUserProfileRequest = z.infer<typeof createUserProfileSchema>;

export const updateUserProfileSchema = z.object({
  weight_kg: z.number().optional(),
  height_cm: z.number().optional(),
  age: z.number().optional(),
  gender: z.string().optional(),
  activity_level: z.string().optional(),
  diet_goal: z.string().optional(),
  dietary_restrictions: z.array(z.string()).optional(),
  allergies: z.array(z.string()).optional(),
  disliked_foods: z.array(z.string()).optional(),
  preferred_cuisines: z.array(z.string()).optional(),
});

export type UpdateUserProfileRequest = z.infer<typeof updateUserProfileSchema>;

export const mealSchema = z.object({
  user_id: z.string(),
  plan_name: z.string(),
  descriptions: z.string(),
  daily_calories: z.number(),
  daily_protein: z.number(),
  daily_fat_g: z.number(),
  created_by: z.string().default("system"),
  meals: z.array(z.record(z.any())).default([]),
});
