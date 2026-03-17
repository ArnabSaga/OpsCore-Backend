import { Router } from "express";
import { WorkspaceMemberRole } from "../../../generated/prisma/enums";
import { requireAuth } from "../../middlewares/requireAuth";
import { requireFeature } from "../../middlewares/requireFeature";
import { requireRole } from "../../middlewares/requireRole";
import { workspaceContext } from "../../middlewares/workspaceContext";
import validateRequest from "../../middlewares/validateRequest";
import { InvitationController } from "./invitation.controller";
import { InvitationValidation } from "./invitation.validation";

const router = Router();

router.use(requireAuth);

router.get(
  "/workspaces/:workspaceId/invitations",
  validateRequest(InvitationValidation.workspaceInvitationParamsSchema),
  workspaceContext,
  requireFeature("workspace.memberManagement"),
  requireRole(WorkspaceMemberRole.OWNER, WorkspaceMemberRole.ADMIN),
  InvitationController.getInvitations
);

router.post(
  "/workspaces/:workspaceId/invitations",
  validateRequest(InvitationValidation.workspaceInvitationParamsSchema),
  workspaceContext,
  requireFeature("workspace.memberManagement"),
  requireRole(WorkspaceMemberRole.OWNER, WorkspaceMemberRole.ADMIN),
  validateRequest(InvitationValidation.createInvitationSchema),
  InvitationController.createInvitation
);

router.delete(
  "/workspaces/:workspaceId/invitations/:invitationId",
  validateRequest(InvitationValidation.invitationIdParamsSchema),
  workspaceContext,
  requireFeature("workspace.memberManagement"),
  requireRole(WorkspaceMemberRole.OWNER, WorkspaceMemberRole.ADMIN),
  InvitationController.cancelInvitation
);

router.post(
  "/invitations/:token/accept",
  validateRequest(InvitationValidation.invitationTokenParamsSchema),
  InvitationController.acceptInvitation
);

router.post(
  "/invitations/:token/decline",
  validateRequest(InvitationValidation.invitationTokenParamsSchema),
  InvitationController.declineInvitation
);

export const InvitationRoutes = router;
