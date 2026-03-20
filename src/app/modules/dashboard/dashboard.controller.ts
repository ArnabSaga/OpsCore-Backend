import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { pick } from "../../utils/pick";
import { sendResponse } from "../../utils/sendResponse";
import { IDashboardActivityQuery } from "./dashboard.interface";
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
  ]) as IDashboardActivityQuery;

  const result = await DashboardService.getActivity(req, query);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Dashboard activity fetched successfully",
    data: result.data,
    meta: result.meta,
  });
});

export const DashboardController = {
  getOverview,
  getActivity,
};
