import { z } from "zod";

const updateProfileSchema = z.object({
  body: z
    .object({
      name: z
        .string()
        .trim()
        .min(2, "Name must be at least 2 characters")
        .max(100, "Name cannot exceed 100 characters")
        .optional(),
      removeImage: z.enum(["true", "false"]).optional(),
    })
    .strict()
    .optional(),
});

export const UserValidation = {
  updateProfileSchema,
};
