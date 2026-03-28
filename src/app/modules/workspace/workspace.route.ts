import { Router } from "express";
import { WorkspaceMemberRole } from "../../constants/role";
import { requireAuth } from "../../middlewares/requireAuth";
import { requireRole } from "../../middlewares/requireRole";
import { requireSystemRole } from "../../middlewares/requireSystemRole";
import { SystemRole } from "../../constants/role";
import validateRequest from "../../middlewares/validateRequest";
import { workspaceContext } from "../../middlewares/workspaceContext";
import { WorkspaceController } from "./workspace.controller";
import { WorkspaceValidation } from "./workspace.validation";

const router = Router();

router.use(requireAuth);

router.get("/my", WorkspaceController.getMyWorkspaces);

router.get(
  "/platform/all",
  requireSystemRole(SystemRole.SUPER_ADMIN),
  WorkspaceController.getPlatformWorkspaces
);

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
  validateRequest(WorkspaceValidation.deleteWorkspaceSchema),
  workspaceContext,
  requireRole(WorkspaceMemberRole.OWNER),
  WorkspaceController.deleteWorkspace
);

// General Settings
router.get(
  "/:workspaceId/settings/general",
  validateRequest(WorkspaceValidation.workspaceIdParamSchema),
  workspaceContext,
  WorkspaceController.getGeneralSettings
);

router.patch(
  "/:workspaceId/settings/general",
  validateRequest(WorkspaceValidation.workspaceIdParamSchema),
  workspaceContext,
  requireRole(WorkspaceMemberRole.OWNER),
  validateRequest(WorkspaceValidation.updateGeneralSettingsSchema),
  WorkspaceController.updateGeneralSettings
);

// Branding
router.get(
  "/:workspaceId/settings/branding",
  validateRequest(WorkspaceValidation.workspaceIdParamSchema),
  workspaceContext,
  WorkspaceController.getBranding
);

router.patch(
  "/:workspaceId/settings/branding",
  validateRequest(WorkspaceValidation.workspaceIdParamSchema),
  workspaceContext,
  requireRole(WorkspaceMemberRole.OWNER),
  validateRequest(WorkspaceValidation.updateBrandingSchema),
  WorkspaceController.updateBranding
);

// Summary
router.get(
  "/:workspaceId/settings/summary",
  validateRequest(WorkspaceValidation.workspaceIdParamSchema),
  workspaceContext,
  WorkspaceController.getSummary
);

// Capabilities
router.get(
  "/:workspaceId/capabilities",
  validateRequest(WorkspaceValidation.workspaceIdParamSchema),
  workspaceContext,
  WorkspaceController.getCapabilities
);

// Permissions
router.get(
  "/:workspaceId/settings/permissions",
  validateRequest(WorkspaceValidation.workspaceIdParamSchema),
  workspaceContext,
  WorkspaceController.getPermissions
);

router.get(
  "/:workspaceId/activity-logs",
  validateRequest(WorkspaceValidation.workspaceIdParamSchema),
  workspaceContext,
  requireRole(WorkspaceMemberRole.OWNER, WorkspaceMemberRole.ADMIN),
  WorkspaceController.getActivityLogs
);

router.post(
  "/:workspaceId/archive",
  validateRequest(WorkspaceValidation.workspaceIdParamSchema),
  workspaceContext,
  requireRole(WorkspaceMemberRole.OWNER),
  WorkspaceController.archiveWorkspace
);

export const WorkspaceRoutes = router;
