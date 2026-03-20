import { Router } from "express";
import validateRequest from "../../middlewares/validateRequest";
import { HealthController } from "./health.controller";
import { HealthValidation } from "./health.validation";

const router = Router();

router.get("/", validateRequest(HealthValidation.getHealthSchema), HealthController.getHealth);

router.get(
  "/db",
  validateRequest(HealthValidation.getDatabaseHealthSchema),
  HealthController.getDatabaseHealth
);

router.get(
  "/ready",
  validateRequest(HealthValidation.getReadinessSchema),
  HealthController.getReadiness
);

export const HealthRoutes = router;
