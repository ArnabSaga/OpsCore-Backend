import { z } from "zod";

const workspaceInvitationParamsSchema = z.object({
  params: z.object({
    workspaceId: z.string().uuid("Workspace ID must be a valid UUID"),
  }),
});

const invitationIdParamsSchema = z.object({
  params: z.object({
    workspaceId: z.string().uuid("Workspace ID must be a valid UUID"),
    invitationId: z.string().uuid("Invitation ID must be a valid UUID"),
  }),
});

const invitationTokenParamsSchema = z.object({
  params: z.object({
    token: z.string().trim().min(20, "Invitation token is invalid"),
  }),
});

const createInvitationSchema = z.object({
  body: z.object({
    email: z.string().trim().toLowerCase().email("Invalid email address"),
    role: z.enum(["ADMIN", "MEMBER"]).optional().default("MEMBER"),
  }),
});

export const InvitationValidation = {
  workspaceInvitationParamsSchema,
  invitationIdParamsSchema,
  invitationTokenParamsSchema,
  createInvitationSchema,
};
