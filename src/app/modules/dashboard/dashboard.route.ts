import { Router } from "express";
import { requireAuth } from "../../middlewares/requireAuth";
import { requireFeature } from "../../middlewares/requireFeature";
import validateRequest from "../../middlewares/validateRequest";
import { workspaceContext } from "../../middlewares/workspaceContext";
import { DashboardController } from "./dashboard.controller";
import { DashboardValidation } from "./dashboard.validation";

const router = Router();

router.use(requireAuth);
router.use(workspaceContext);

router.get(
  "/overview",
  requireFeature("dashboard.overview"),
  validateRequest(DashboardValidation.getDashboardOverviewSchema),
  DashboardController.getOverview
);

router.get(
  "/activity",
  requireFeature("dashboard.activity"),
  validateRequest(DashboardValidation.getDashboardActivitySchema),
  DashboardController.getActivity
);

export const DashboardRoutes = router;
