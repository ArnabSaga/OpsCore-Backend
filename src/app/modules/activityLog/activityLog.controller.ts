import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { pick } from "../../utils/pick";
import { sendResponse } from "../../utils/sendResponse";
import { ActivityLogService } from "./activityLog.service";
import { IActivityLogQuery } from "./activityLog.interface";

const getActivityLogs = catchAsync(async (req: Request, res: Response) => {
  const query = pick(req.query as Record<string, unknown>, [
    "page",
    "limit",
    "action",
    "entityType",
    "userId",
    "from",
    "to",
  ]) as IActivityLogQuery;

  const result = await ActivityLogService.getActivityLogs(req, query);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Activity logs fetched successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getActivityLog = catchAsync(async (req: Request, res: Response) => {
  const result = await ActivityLogService.getActivityLog(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Activity log fetched successfully",
    data: result,
  });
});

export const ActivityLogController = {
  getActivityLogs,
  getActivityLog,
};
