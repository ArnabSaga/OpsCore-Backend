import { Router } from "express";
import { SystemRole } from "../../constants/role";
import { requireAuth } from "../../middlewares/requireAuth";
import { requireFeature } from "../../middlewares/requireFeature";
import { requireSystemRole } from "../../middlewares/requireSystemRole";
import validateRequest from "../../middlewares/validateRequest";
import { workspaceContext } from "../../middlewares/workspaceContext";
import { DashboardController } from "./dashboard.controller";
import { DashboardValidation } from "./dashboard.validation";

const router = Router();

router.use(requireAuth);

const workspaceRouter = Router();
workspaceRouter.use(workspaceContext);

workspaceRouter.get(
  "/overview",
  requireFeature("dashboard.overview"),
  validateRequest(DashboardValidation.getDashboardOverviewSchema),
  DashboardController.getOverview
);

workspaceRouter.get(
  "/activity",
  requireFeature("dashboard.activity"),
  validateRequest(DashboardValidation.getDashboardActivitySchema),
  DashboardController.getActivity
);

workspaceRouter.get(
  "/metrics",
  requireFeature("dashboard.overview"),
  validateRequest(DashboardValidation.getDashboardMetricsSchema),
  DashboardController.getMetrics
);

const platformRouter = Router();
platformRouter.use(requireSystemRole(SystemRole.SUPER_ADMIN));

platformRouter.get("/overview", DashboardController.getPlatformOverview);

platformRouter.get(
  "/activity",
  validateRequest(DashboardValidation.getDashboardActivitySchema),
  DashboardController.getPlatformActivity
);

platformRouter.get(
  "/metrics",
  validateRequest(DashboardValidation.getDashboardMetricsSchema),
  DashboardController.getPlatformMetrics
);

router.use("/platform", platformRouter);
router.use("/", workspaceRouter);
export const DashboardRoutes = router;
