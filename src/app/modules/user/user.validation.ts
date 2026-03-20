import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(100, "Password cannot exceed 100 characters");

const updateProfileValidationSchema = z.object({
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

const updatePasswordValidationSchema = z.object({
  body: z
    .object({
      currentPassword: z.string().min(1, "Current password is required"),
      newPassword: passwordSchema,
      confirmPassword: z.string().min(1, "Confirm password is required"),
    })
    .strict()
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: "New password and confirm password do not match",
      path: ["confirmPassword"],
    }),
});

export const UserValidation = {
  updateProfileValidationSchema,
  updatePasswordValidationSchema,
};
