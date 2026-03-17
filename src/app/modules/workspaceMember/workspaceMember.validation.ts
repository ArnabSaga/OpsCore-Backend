import { z } from "zod";

const workspaceIdParamSchema = z.object({
  params: z.object({
    workspaceId: z.string().uuid("Workspace ID must be a valid UUID"),
  }),
});

const workspaceMemberParamsSchema = z.object({
  params: z.object({
    workspaceId: z.string().uuid("Workspace ID must be a valid UUID"),
    memberId: z.string().uuid("Member ID must be a valid UUID"),
  }),
});

const updateWorkspaceMemberSchema = z.object({
  body: z
    .object({
      role: z.enum(["OWNER", "ADMIN", "MEMBER"]).optional(),
      status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
    })
    .refine((data) => data.role !== undefined || data.status !== undefined, {
      message: "At least one field (role or status) must be provided",
    }),
});

export const WorkspaceMemberValidation = {
  workspaceIdParamSchema,
  workspaceMemberParamsSchema,
  updateWorkspaceMemberSchema,
};
