import { Router } from "express";
import { WorkspaceMemberRole } from "../../constants/role";
import { requireAuth } from "../../middlewares/requireAuth";
import { requireFeature } from "../../middlewares/requireFeature";
import { requireRole } from "../../middlewares/requireRole";
import validateRequest from "../../middlewares/validateRequest";
import { workspaceContext } from "../../middlewares/workspaceContext";
import { ActivityLogController } from "./activityLog.controller";
import { ActivityLogValidation } from "./activityLog.validation";

const router = Router();

router.use(requireAuth);
router.use(workspaceContext);

router.get(
  "/",
  requireFeature("activityLogs.read"),
  requireRole(WorkspaceMemberRole.OWNER, WorkspaceMemberRole.ADMIN),
  validateRequest(ActivityLogValidation.getActivityLogsQuerySchema),
  ActivityLogController.getActivityLogs
);

router.get(
  "/:logId",
  requireFeature("activityLogs.read"),
  requireRole(WorkspaceMemberRole.OWNER, WorkspaceMemberRole.ADMIN),
  validateRequest(ActivityLogValidation.activityLogIdParamSchema),
  ActivityLogController.getActivityLog
);

export const ActivityLogRoutes = router;
