import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { pick } from "../../utils/pick";
import { sendResponse } from "../../utils/sendResponse";
import {
  IWorkspaceDashboardActivityQuery,
  IWorkspaceDashboardMetricsQuery,
  IPlatformDashboardActivityQuery,
  IPlatformDashboardMetricsQuery,
} from "./dashboard.interface";
import { DashboardService } from "./dashboard.service";

const getOverview = catchAsync(async (req: Request, res: Response) => {
  const result = await DashboardService.getOverview(req, req.query);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Dashboard overview fetched successfully",
    data: result,
  });
});

const getActivity = catchAsync(async (req: Request, res: Response) => {
  const query = pick(req.query as Record<string, unknown>, [
    "page",
    "limit",
  ]) as IWorkspaceDashboardActivityQuery;

  const result = await DashboardService.getActivity(req, query);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Dashboard activity fetched successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getMetrics = catchAsync(async (req: Request, res: Response) => {
  const query = pick(req.query as Record<string, unknown>, [
    "period",
  ]) as IWorkspaceDashboardMetricsQuery;

  const result = await DashboardService.getMetrics(req, query);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Dashboard metrics fetched successfully",
    data: result,
  });
});

const getPlatformOverview = catchAsync(async (req: Request, res: Response) => {
  const result = await DashboardService.getPlatformOverview(req, req.query);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Platform dashboard overview fetched successfully",
    data: result,
  });
});

const getPlatformActivity = catchAsync(async (req: Request, res: Response) => {
  const query = pick(req.query as Record<string, unknown>, [
    "page",
    "limit",
  ]) as IPlatformDashboardActivityQuery;

  const result = await DashboardService.getPlatformActivity(req, query);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Platform dashboard activity fetched successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getPlatformMetrics = catchAsync(async (req: Request, res: Response) => {
  const query = pick(req.query as Record<string, unknown>, [
    "period",
  ]) as IPlatformDashboardMetricsQuery;

  const result = await DashboardService.getPlatformMetrics(req, query);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Platform dashboard metrics fetched successfully",
    data: result,
  });
});

export const DashboardController = {
  getOverview,
  getActivity,
  getMetrics,
  getPlatformOverview,
  getPlatformActivity,
  getPlatformMetrics,
};
