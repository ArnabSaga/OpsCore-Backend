import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { BillingService } from "./billing.service";

const getCurrentWorkspaceSubscription = catchAsync(async (req: Request, res: Response) => {
  const result = await BillingService.getCurrentWorkspaceSubscription(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Workspace subscription fetched successfully",
    data: result,
  });
});

const prepareCheckoutFlow = catchAsync(async (req: Request, res: Response) => {
  const result = await BillingService.prepareCheckoutFlow(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Checkout flow prepared successfully",
    data: result,
  });
});

const createCustomerPortal = catchAsync(async (req: Request, res: Response) => {
  const result = await BillingService.createCustomerPortal(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Customer portal session created successfully",
    data: result,
  });
});

const getBillingHistory = catchAsync(async (req: Request, res: Response) => {
  const result = await BillingService.getBillingHistory(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Billing history fetched successfully",
    data: result,
  });
});

export const BillingController = {
  getCurrentWorkspaceSubscription,
  prepareCheckoutFlow,
  createCustomerPortal,
  getBillingHistory,
};
