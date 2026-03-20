import { Router } from "express";
import { WorkspaceMemberRole } from "../../constants/role";
import { requireAuth } from "../../middlewares/requireAuth";
import { requireFeature } from "../../middlewares/requireFeature";
import { requireRole } from "../../middlewares/requireRole";
import validateRequest from "../../middlewares/validateRequest";
import { workspaceContext } from "../../middlewares/workspaceContext";
import { InvoiceController } from "./invoice.controller";
import { InvoiceValidation } from "./invoice.validation";

const router = Router();

router.use(requireAuth);
router.use(workspaceContext);

router.get(
  "/",
  requireRole(WorkspaceMemberRole.OWNER, WorkspaceMemberRole.ADMIN),
  validateRequest(InvoiceValidation.getInvoicesQuerySchema),
  InvoiceController.getInvoices
);

router.post(
  "/",
  requireFeature("invoices.create"),
  requireRole(WorkspaceMemberRole.OWNER, WorkspaceMemberRole.ADMIN),
  validateRequest(InvoiceValidation.createInvoiceSchema),
  InvoiceController.createInvoice
);

router.get(
  "/:invoiceId",
  requireRole(WorkspaceMemberRole.OWNER, WorkspaceMemberRole.ADMIN),
  validateRequest(InvoiceValidation.invoiceIdParamSchema),
  InvoiceController.getInvoice
);

router.patch(
  "/:invoiceId",
  requireRole(WorkspaceMemberRole.OWNER, WorkspaceMemberRole.ADMIN),
  validateRequest(InvoiceValidation.invoiceIdParamSchema),
  validateRequest(InvoiceValidation.updateInvoiceSchema),
  InvoiceController.updateInvoice
);

router.delete(
  "/:invoiceId",
  requireRole(WorkspaceMemberRole.OWNER, WorkspaceMemberRole.ADMIN),
  validateRequest(InvoiceValidation.invoiceIdParamSchema),
  InvoiceController.deleteInvoice
);

router.post(
  "/:invoiceId/send",
  requireFeature("invoices.send"),
  requireRole(WorkspaceMemberRole.OWNER, WorkspaceMemberRole.ADMIN),
  validateRequest(InvoiceValidation.invoiceIdParamSchema),
  InvoiceController.sendInvoice
);

router.post(
  "/:invoiceId/mark-paid",
  requireRole(WorkspaceMemberRole.OWNER, WorkspaceMemberRole.ADMIN),
  validateRequest(InvoiceValidation.invoiceIdParamSchema),
  InvoiceController.markInvoicePaid
);

router.post(
  "/:invoiceId/cancel",
  requireRole(WorkspaceMemberRole.OWNER, WorkspaceMemberRole.ADMIN),
  validateRequest(InvoiceValidation.invoiceIdParamSchema),
  InvoiceController.cancelInvoice
);

export const InvoiceRoutes = router;
