import { Router } from "express";
import { WorkspaceMemberRole } from "../../constants/role";
import { requireAuth } from "../../middlewares/requireAuth";
import { requireFeature } from "../../middlewares/requireFeature";
import { requireRole } from "../../middlewares/requireRole";
import { workspaceContext } from "../../middlewares/workspaceContext";
import validateRequest from "../../middlewares/validateRequest";
import { InvitationController } from "./invitation.controller";
import { InvitationValidation } from "./invitation.validation";

const workspaceInvitationRouter = Router({ mergeParams: true });
const invitationActionRouter = Router();

workspaceInvitationRouter.use(requireAuth);
workspaceInvitationRouter.use(
  validateRequest(InvitationValidation.workspaceInvitationParamsSchema)
);
workspaceInvitationRouter.use(workspaceContext);

workspaceInvitationRouter.get(
  "/",
  requireFeature("workspace.memberManagement"),
  requireRole(WorkspaceMemberRole.OWNER, WorkspaceMemberRole.ADMIN),
  InvitationController.getInvitations
);

workspaceInvitationRouter.post(
  "/",
  requireFeature("workspace.memberManagement"),
  requireRole(WorkspaceMemberRole.OWNER, WorkspaceMemberRole.ADMIN),
  validateRequest(InvitationValidation.createInvitationSchema),
  InvitationController.createInvitation
);

workspaceInvitationRouter.delete(
  "/:invitationId",
  validateRequest(InvitationValidation.invitationIdParamsSchema),
  requireFeature("workspace.memberManagement"),
  requireRole(WorkspaceMemberRole.OWNER, WorkspaceMemberRole.ADMIN),
  InvitationController.cancelInvitation
);

workspaceInvitationRouter.post(
  "/:invitationId/resend",
  validateRequest(InvitationValidation.invitationIdParamsSchema),
  requireFeature("workspace.memberManagement"),
  requireRole(WorkspaceMemberRole.OWNER, WorkspaceMemberRole.ADMIN),
  InvitationController.resendInvitation
);

workspaceInvitationRouter.post(
  "/:invitationId/expire",
  validateRequest(InvitationValidation.invitationIdParamsSchema),
  requireFeature("workspace.memberManagement"),
  requireRole(WorkspaceMemberRole.OWNER, WorkspaceMemberRole.ADMIN),
  InvitationController.expireInvitation
);

workspaceInvitationRouter.delete(
  "/:invitationId/hard-delete",
  validateRequest(InvitationValidation.invitationIdParamsSchema),
  requireFeature("workspace.memberManagement"),
  requireRole(WorkspaceMemberRole.OWNER, WorkspaceMemberRole.ADMIN),
  InvitationController.deleteInvitation
);

invitationActionRouter.use(requireAuth);

invitationActionRouter.get(
  "/my",
  InvitationController.getMyInvitations
);

invitationActionRouter.get(
  "/:token",
  validateRequest(InvitationValidation.invitationTokenParamsSchema),
  InvitationController.getInvitationByToken
);

invitationActionRouter.post(
  "/:token/accept",
  validateRequest(InvitationValidation.invitationTokenParamsSchema),
  InvitationController.acceptInvitation
);

invitationActionRouter.post(
  "/:token/decline",
  validateRequest(InvitationValidation.invitationTokenParamsSchema),
  InvitationController.declineInvitation
);

export const InvitationWorkspaceRoutes = workspaceInvitationRouter;
export const InvitationActionRoutes = invitationActionRouter;
