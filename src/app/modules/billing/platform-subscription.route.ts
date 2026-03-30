import { Router } from "express";
import { SystemRole } from "../../constants/role";
import { requireAuth } from "../../middlewares/requireAuth";
import { requireSystemRole } from "../../middlewares/requireSystemRole";
import { BillingController } from "./billing.controller";

const router = Router();

router.use(requireAuth);
router.use(requireSystemRole(SystemRole.SUPER_ADMIN));

router.get(
  "/",
  BillingController.getPlatformSubscriptions
);

export const PlatformSubscriptionRoutes = router;
