import { Router } from "express";
import { SystemRole } from "../../constants/role";
import { requireAuth } from "../../middlewares/requireAuth";
import { requireSystemRole } from "../../middlewares/requireSystemRole";
import validateRequest from "../../middlewares/validateRequest";
import { InvoiceController } from "./invoice.controller";
import { InvoiceValidation } from "./invoice.validation";

const router = Router();

router.use(requireAuth);
router.use(requireSystemRole(SystemRole.SUPER_ADMIN));

router.get(
  "/",
  validateRequest(InvoiceValidation.getPlatformInvoicesQuerySchema),
  InvoiceController.getPlatformInvoices
);

export const PlatformInvoiceRoutes = router;
