import { z } from "zod";

const workspaceIdParamSchema = z.object({
  params: z.object({
    workspaceId: z.string().uuid("Workspace ID must be a valid UUID"),
  }),
});

const memberRouteParamSchema = z.object({
  params: z.object({
    workspaceId: z.string().uuid("Workspace ID must be a valid UUID"),
    memberId: z.string().uuid("Member ID must be a valid UUID"),
  }),
});

const createWorkspaceSchema = z.object({
  body: z.object({
    name: z
      .string()
      .trim()
      .min(2, "Workspace name must be at least 2 characters")
      .max(120, "Workspace name cannot exceed 120 characters"),
  }),
});

const updateWorkspaceSchema = z.object({
  body: z
    .object({
      name: z
        .string()
        .trim()
        .min(2, "Workspace name must be at least 2 characters")
        .max(120, "Workspace name cannot exceed 120 characters")
        .optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field must be provided",
    }),
});

const updateMemberSchema = z.object({
  body: z
    .object({
      role: z.enum(["OWNER", "ADMIN", "MEMBER"]).optional(),
      status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
    })
    .refine((data) => data.role !== undefined || data.status !== undefined, {
      message: "At least one field (role or status) must be provided",
    }),
});

const updateGeneralSettingsSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2, "Workspace name must be at least 2 characters").max(120).optional(),
    description: z.string().max(500).optional().nullable(),
    timezone: z.string().max(100).optional().nullable(),
    currency: z.string().length(3, "Currency must be 3 characters").optional().nullable(),
    supportEmail: z.string().email().optional().nullable(),
    billingEmail: z.string().email().optional().nullable(),
  }),
});

const updateBrandingSchema = z.object({
  body: z.object({
    logoUrl: z.string().url().optional().nullable(),
    faviconUrl: z.string().url().optional().nullable(),
    primaryColor: z.string().regex(/^#([0-9A-F]{3}|[0-9A-F]{6})$/i, "Invalid hex color").optional().nullable(),
    accentColor: z.string().regex(/^#([0-9A-F]{3}|[0-9A-F]{6})$/i, "Invalid hex color").optional().nullable(),
    customDomain: z.string().max(255).optional().nullable(),
    emailBrandName: z.string().max(120).optional().nullable(),
  }),
});

const deleteWorkspaceSchema = z.object({
  body: z.object({
    confirmName: z.string().min(1, "Confirmation name is required"),
  }),
});

export const WorkspaceValidation = {
  workspaceIdParamSchema,
  memberRouteParamSchema,
  createWorkspaceSchema,
  updateWorkspaceSchema,
  updateMemberSchema,
  updateGeneralSettingsSchema,
  updateBrandingSchema,
  deleteWorkspaceSchema,
};

