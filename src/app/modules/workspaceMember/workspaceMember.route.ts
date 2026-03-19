import { Router } from "express";
import { WorkspaceMemberRole } from "../../../generated/prisma/enums";
import { requireAuth } from "../../middlewares/requireAuth";
import { requireFeature } from "../../middlewares/requireFeature";
import { requireRole } from "../../middlewares/requireRole";
import validateRequest from "../../middlewares/validateRequest";
import { workspaceContext } from "../../middlewares/workspaceContext";
import { WorkspaceMemberController } from "./workspaceMember.controller";
import { WorkspaceMemberValidation } from "./workspaceMember.validation";

const router = Router();

router.use(requireAuth);

router.get(
  "/workspaces/:workspaceId/members",
  validateRequest(WorkspaceMemberValidation.workspaceIdParamSchema),
  workspaceContext,
  requireFeature("workspace.memberManagement"),
  requireRole(WorkspaceMemberRole.OWNER, WorkspaceMemberRole.ADMIN),
  WorkspaceMemberController.getMembers
);

router.patch(
  "/workspaces/:workspaceId/members/:memberId",
  validateRequest(WorkspaceMemberValidation.workspaceMemberParamsSchema),
  workspaceContext,
  requireFeature("workspace.advancedPermissions"),
  requireRole(WorkspaceMemberRole.OWNER, WorkspaceMemberRole.ADMIN),
  validateRequest(WorkspaceMemberValidation.updateWorkspaceMemberSchema),
  WorkspaceMemberController.updateMember
);

router.delete(
  "/workspaces/:workspaceId/members/:memberId",
  validateRequest(WorkspaceMemberValidation.workspaceMemberParamsSchema),
  workspaceContext,
  requireFeature("workspace.advancedPermissions"),
  requireRole(WorkspaceMemberRole.OWNER, WorkspaceMemberRole.ADMIN),
  WorkspaceMemberController.removeMember
);

export const WorkspaceMemberRoutes = router;
