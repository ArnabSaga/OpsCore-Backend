import { Router } from "express";
import { WorkspaceMemberRole } from "../../constants/role";
import { requireAuth } from "../../middlewares/requireAuth";
import { requireFeature } from "../../middlewares/requireFeature";
import { requireRole } from "../../middlewares/requireRole";
import validateRequest from "../../middlewares/validateRequest";
import { workspaceContext } from "../../middlewares/workspaceContext";
import { AnalyticsController } from "./analytics.controller";
import { AnalyticsValidation } from "./analytics.validation";

const router = Router();

router.use(requireAuth);
router.use(workspaceContext);

router.get(
  "/projects",
  requireFeature("analytics.projects"),
  requireRole(WorkspaceMemberRole.OWNER, WorkspaceMemberRole.ADMIN),
  validateRequest(AnalyticsValidation.getProjectsAnalyticsSchema),
  AnalyticsController.getProjectsAnalytics
);

router.get(
  "/revenue",
  requireFeature("analytics.revenue"),
  requireRole(WorkspaceMemberRole.OWNER, WorkspaceMemberRole.ADMIN),
  validateRequest(AnalyticsValidation.getRevenueAnalyticsSchema),
  AnalyticsController.getRevenueAnalytics
);

export const AnalyticsRoutes = router;
