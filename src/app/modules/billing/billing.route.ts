import { Router } from "express";
import { WorkspaceMemberRole } from "../../../generated/prisma/enums";
import { requireAuth } from "../../middlewares/requireAuth";
import { requireFeature } from "../../middlewares/requireFeature";
import { requireRole } from "../../middlewares/requireRole";
import validateRequest from "../../middlewares/validateRequest";
import { workspaceContext } from "../../middlewares/workspaceContext";
import { BillingController } from "./billing.controller";
import { BillingValidation } from "./billing.validation";

const router = Router();

router.use(requireAuth);
router.use(workspaceContext);
router.use(requireRole(WorkspaceMemberRole.OWNER));

router.get("/subscription", BillingController.getCurrentWorkspaceSubscription);

router.post(
  "/checkout-session",
  requireFeature("billing.checkout"),
  validateRequest(BillingValidation.prepareCheckoutSchema),
  BillingController.prepareCheckoutFlow
);

router.post(
  "/customer-portal",
  requireFeature("billing.customerPortal"),
  validateRequest(BillingValidation.createCustomerPortalSchema),
  BillingController.createCustomerPortal
);

router.get(
  "/invoices",
  validateRequest(BillingValidation.getBillingHistoryQuerySchema),
  BillingController.getBillingHistory
);

export const BillingRoutes = router;
