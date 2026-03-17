import { Router } from "express";
import { WorkspaceMemberRole } from "../../../generated/prisma/enums";
import { requireAuth } from "../../middlewares/requireAuth";
import { requireRole } from "../../middlewares/requireRole";
import validateRequest from "../../middlewares/validateRequest";
import { workspaceContext } from "../../middlewares/workspaceContext";
import { WorkspaceController } from "./workspace.controller";
import { WorkspaceValidation } from "./workspace.validation";

const router = Router();

router.use(requireAuth);

router.get("/", WorkspaceController.getMyWorkspaces);

router.post(
  "/",
  validateRequest(WorkspaceValidation.createWorkspaceSchema),
  WorkspaceController.createWorkspace
);

router.get(
  "/:workspaceId",
  validateRequest(WorkspaceValidation.workspaceIdParamSchema),
  workspaceContext,
  WorkspaceController.getWorkspace
);

router.patch(
  "/:workspaceId",
  validateRequest(WorkspaceValidation.workspaceIdParamSchema),
  workspaceContext,
  requireRole(WorkspaceMemberRole.OWNER),
  validateRequest(WorkspaceValidation.updateWorkspaceSchema),
  WorkspaceController.updateWorkspace
);

router.post(
  "/:workspaceId/switch",
  validateRequest(WorkspaceValidation.workspaceIdParamSchema),
  workspaceContext,
  WorkspaceController.switchWorkspace
);

router.delete(
  "/:workspaceId",
  validateRequest(WorkspaceValidation.workspaceIdParamSchema),
  workspaceContext,
  requireRole(WorkspaceMemberRole.OWNER),
  WorkspaceController.deleteWorkspace
);

export const WorkspaceRoutes = router;
