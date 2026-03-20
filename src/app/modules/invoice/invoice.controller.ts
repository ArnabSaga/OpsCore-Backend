import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { pick } from "../../utils/pick";
import { InvoiceService } from "./invoice.service";

const getInvoices = catchAsync(async (req: Request, res: Response) => {
  const query = pick(req.query as any, [
    "searchTerm",
    "status",
    "overdue",
    "issued",
    "page",
    "limit",
    "sortBy",
    "sortOrder",
  ]);

  const result = await InvoiceService.getInvoices(req.workspaceId!, query);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Invoices fetched successfully",
    data: result.data,
    meta: result.meta,
  });
});

const createInvoice = catchAsync(async (req: Request, res: Response) => {
  const result = await InvoiceService.createInvoice(req);

  sendResponse(res, {
    statusCode: status.CREATED,
    success: true,
    message: "Invoice created successfully",
    data: result,
  });
});

const getInvoice = catchAsync(async (req: Request, res: Response) => {
  const result = await InvoiceService.getInvoice(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Invoice fetched successfully",
    data: result,
  });
});

const updateInvoice = catchAsync(async (req: Request, res: Response) => {
  const result = await InvoiceService.updateInvoice(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Invoice updated successfully",
    data: result,
  });
});

const deleteInvoice = catchAsync(async (req: Request, res: Response) => {
  await InvoiceService.deleteInvoice(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Invoice deleted successfully",
  });
});

const sendInvoice = catchAsync(async (req: Request, res: Response) => {
  const result = await InvoiceService.sendInvoice(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Invoice sent successfully",
    data: result,
  });
});

const markInvoicePaid = catchAsync(async (req: Request, res: Response) => {
  const result = await InvoiceService.markInvoicePaid(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Invoice marked as paid successfully",
    data: result,
  });
});

const cancelInvoice = catchAsync(async (req: Request, res: Response) => {
  const result = await InvoiceService.cancelInvoice(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Invoice cancelled successfully",
    data: result,
  });
});

export const InvoiceController = {
  getInvoices,
  createInvoice,
  getInvoice,
  updateInvoice,
  deleteInvoice,
  sendInvoice,
  markInvoicePaid,
  cancelInvoice,
};
