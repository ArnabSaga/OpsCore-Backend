import { Router } from "express";
import { WorkspaceMemberRole } from "../../../generated/prisma/enums";
import { requireAuth } from "../../middlewares/requireAuth";
import { requireFeature } from "../../middlewares/requireFeature";
import { requireRole } from "../../middlewares/requireRole";
import validateRequest from "../../middlewares/validateRequest";
import { workspaceContext } from "../../middlewares/workspaceContext";
import { WorkspaceMemberController } from "./workspaceMember.controller";
import { WorkspaceMemberValidation } from "./workspaceMember.validation";

const router = Router({ mergeParams: true });

router.use(requireAuth);
router.use(validateRequest(WorkspaceMemberValidation.workspaceIdParamSchema));
router.use(workspaceContext);

router.get(
  "/",
  requireFeature("workspace.memberManagement"),
  requireRole(WorkspaceMemberRole.OWNER, WorkspaceMemberRole.ADMIN),
  WorkspaceMemberController.getMembers
);

router.patch(
  "/:memberId",
  validateRequest(WorkspaceMemberValidation.workspaceMemberParamsSchema),
  requireFeature("workspace.advancedPermissions"),
  requireRole(WorkspaceMemberRole.OWNER, WorkspaceMemberRole.ADMIN),
  validateRequest(WorkspaceMemberValidation.updateWorkspaceMemberSchema),
  WorkspaceMemberController.updateMember
);

router.delete(
  "/:memberId",
  validateRequest(WorkspaceMemberValidation.workspaceMemberParamsSchema),
  requireFeature("workspace.advancedPermissions"),
  requireRole(WorkspaceMemberRole.OWNER, WorkspaceMemberRole.ADMIN),
  WorkspaceMemberController.removeMember
);

export const WorkspaceMemberRoutes = router;
