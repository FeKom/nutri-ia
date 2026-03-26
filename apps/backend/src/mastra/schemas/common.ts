import z from "zod";

export const paginationParamsSchema = z.object({
  limit: z.number().int().min(1).max(100).default(10),
  offset: z.number().int().min(0).default(0),
});

export const paginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    success: z.boolean().default(true),
    data: z.array(itemSchema),
    count: z.number().int(),
    limit: z.number().int(),
    offset: z.number().int(),
    total: z.number().int().optional(),
  });

export const standardResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean().default(true),
    data: dataSchema.optional(),
    message: z.string().optional(),
    error: z.string().optional(),
  });
