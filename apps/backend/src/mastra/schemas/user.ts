import z from "zod";

export const userProfileSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  name: z.string(),
  age: z.number(),
  weight_kg: z.number().optional(),
  height_cm: z.number().optional(),
  gender: z.string().optional(),
  activity_level: z.enum([
    "sedentary",
    "light",
    "moderate",
    "active",
    "very_active",
  ]),
  diet_goal: z.enum(["weight_loss", "weight_gain", "maintain"]),
  dietary_restrictions: z.array(z.string()).optional(),
  allergies: z.array(z.string()).optional(),
  disliked_foods: z.array(z.string()).optional(),
  preferred_cuisines: z.array(z.string()).optional(),
});

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
