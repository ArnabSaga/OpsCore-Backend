import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { pick } from "../../utils/pick";
import { sendResponse } from "../../utils/sendResponse";
import { IAnalyticsProjectsQuery, IAnalyticsRevenueQuery } from "./analytics.interface";
import { AnalyticsService } from "./analytics.service";

const getProjectsAnalytics = catchAsync(async (req: Request, res: Response) => {
  const query = pick(req.query as Record<string, unknown>, [
    "from",
    "to",
    "limit",
  ]) as IAnalyticsProjectsQuery;

  const result = await AnalyticsService.getProjectsAnalytics(req, query);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Project analytics fetched successfully",
    data: result,
  });
});

const getRevenueAnalytics = catchAsync(async (req: Request, res: Response) => {
  const query = pick(req.query as Record<string, unknown>, [
    "from",
    "to",
    "currency",
  ]) as IAnalyticsRevenueQuery;

  const result = await AnalyticsService.getRevenueAnalytics(req, query);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Revenue analytics fetched successfully",
    data: result,
  });
});

export const AnalyticsController = {
  getProjectsAnalytics,
  getRevenueAnalytics,
};
