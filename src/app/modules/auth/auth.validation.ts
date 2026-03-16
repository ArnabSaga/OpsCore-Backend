import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(100, "Password cannot exceed 100 characters");

const registerSchema = z.object({
  body: z
    .object({
      name: z
        .string()
        .trim()
        .min(2, "Name must be at least 2 characters")
        .max(100, "Name cannot exceed 100 characters"),

      email: z.string().trim().toLowerCase().email("Invalid email address"),

      password: passwordSchema,

      confirmPassword: z.string(),

      workspaceName: z
        .string()
        .trim()
        .min(2, "Workspace name must be at least 2 characters")
        .max(120, "Workspace name cannot exceed 120 characters"),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: "Password and confirm password do not match",
      path: ["confirmPassword"],
    }),
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().trim().toLowerCase().email("Invalid email address"),
    password: z.string().min(1, "Password is required"),
  }),
});

const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().trim().toLowerCase().email("Invalid email address"),
  }),
});

const resetPasswordSchema = z.object({
  body: z
    .object({
      email: z.string().trim().toLowerCase().email("Invalid email address"),
      otp: z.string().trim().min(1, "OTP is required").length(6, "OTP must be 6 digits"),
      newPassword: passwordSchema,
      confirmPassword: z.string(),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: "New password and confirm password do not match",
      path: ["confirmPassword"],
    }),
});

const changePasswordSchema = z.object({
  body: z
    .object({
      currentPassword: z.string().min(1, "Current password is required"),
      newPassword: passwordSchema,
      confirmPassword: z.string(),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: "New password and confirm password do not match",
      path: ["confirmPassword"],
    }),
});

const verifyEmailSchema = z.object({
  body: z.object({
    email: z.string().trim().toLowerCase().email("Invalid email address"),
    otp: z.string().trim().min(1, "OTP is required").length(6, "OTP must be 6 digits"),
  }),
});

const resendVerificationSchema = z.object({
  body: z.object({
    email: z.string().trim().toLowerCase().email("Invalid email address"),
  }),
});

export const AuthValidation = {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  verifyEmailSchema,
  resendVerificationSchema,
};
