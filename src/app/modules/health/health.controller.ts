import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { HealthService } from "./health.service";

const getHealth = catchAsync(async (_req: Request, res: Response) => {
  const result = await HealthService.getHealth();

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Health check fetched successfully",
    data: result,
  });
});

const getDatabaseHealth = catchAsync(async (_req: Request, res: Response) => {
  const result = await HealthService.getDatabaseHealth();

  sendResponse(res, {
    statusCode: result.statusCode,
    success: result.statusCode === status.OK,
    message:
      result.statusCode === status.OK
        ? "Database health check fetched successfully"
        : "Database connection is unhealthy",
    data: result.payload,
  });
});

const getReadiness = catchAsync(async (_req: Request, res: Response) => {
  const result = await HealthService.getReadiness();

  sendResponse(res, {
    statusCode: result.statusCode,
    success: result.statusCode === status.OK,
    message:
      result.statusCode === status.OK
        ? "Readiness check fetched successfully"
        : "Application is not ready",
    data: result.payload,
  });
});

export const HealthController = {
  getHealth,
  getDatabaseHealth,
  getReadiness,
};
