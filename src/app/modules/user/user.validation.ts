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
      image: z.string().trim().url("Image must be a valid URL").optional(),
    })
    .refine((data) => data.name !== undefined || data.image !== undefined, {
      message: "At least one field (name or image) must be provided",
    }),
});

export const UserValidation = {
  updateProfileSchema,
};
