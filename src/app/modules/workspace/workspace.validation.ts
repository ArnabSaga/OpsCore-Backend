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

export const WorkspaceValidation = {
  workspaceIdParamSchema,
  memberRouteParamSchema,
  createWorkspaceSchema,
  updateWorkspaceSchema,
  updateMemberSchema,
};
