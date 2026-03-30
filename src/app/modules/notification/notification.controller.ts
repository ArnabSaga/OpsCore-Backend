import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { NotificationService } from "./notification.service";
import status from "http-status";

const getNotifications = catchAsync(async (req: Request, res: Response) => {
  const result = await NotificationService.getNotificationsFromDB(
    req.workspaceId!,
    req.user!.id,
    req.query as any
  );

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Notifications fetched successfully",
    meta: result.meta,
    data: result.data,
  });
});

const getUnreadSummary = catchAsync(async (req: Request, res: Response) => {
  const result = await NotificationService.getUnreadSummaryFromDB(
    req.workspaceId!,
    req.user!.id
  );

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Unread summary fetched successfully",
    data: result,
  });
});

const getNotificationById = catchAsync(async (req: Request, res: Response) => {
  const result = await NotificationService.getNotificationByIdFromDB(
    req.workspaceId!,
    req.user!.id,
    req.params.notificationId as string
  );

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Notification fetched successfully",
    data: result,
  });
});

const markNotificationAsRead = catchAsync(async (req: Request, res: Response) => {
  const result = await NotificationService.markNotificationAsReadIntoDB(
    req.workspaceId!,
    req.user!.id,
    req.params.notificationId as string
  );

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Notification marked as read successfully",
    data: result,
  });
});

const markNotificationAsUnread = catchAsync(async (req: Request, res: Response) => {
  const result = await NotificationService.markNotificationAsUnreadIntoDB(
    req.workspaceId!,
    req.user!.id,
    req.params.notificationId as string
  );

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Notification marked as unread successfully",
    data: result,
  });
});

const markAllNotificationsAsRead = catchAsync(async (req: Request, res: Response) => {
  const result = await NotificationService.markAllNotificationsAsReadIntoDB(
    req.workspaceId!,
    req.user!.id,
    req.body
  );

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "All notifications marked as read successfully",
    data: result,
  });
});

const archiveNotification = catchAsync(async (req: Request, res: Response) => {
  const result = await NotificationService.archiveNotificationIntoDB(
    req.workspaceId!,
    req.user!.id,
    req.params.notificationId as string
  );

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Notification archived successfully",
    data: result,
  });
});

const deleteNotification = catchAsync(async (req: Request, res: Response) => {
  const result = await NotificationService.deleteNotificationFromDB(
    req.workspaceId!,
    req.user!.id,
    req.params.notificationId as string
  );

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Notification deleted successfully",
    data: result,
  });
});

const getNotificationPreferences = catchAsync(async (req: Request, res: Response) => {
  const result = await NotificationService.getNotificationPreferencesFromDB(
    req.workspaceId!,
    req.user!.id
  );

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Notification preferences fetched successfully",
    data: result,
  });
});

const updateNotificationPreferences = catchAsync(async (req: Request, res: Response) => {
  const result = await NotificationService.updateNotificationPreferencesIntoDB(
    req.workspaceId!,
    req.user!.id,
    req.body
  );

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Notification preferences updated successfully",
    data: result,
  });
});

export const NotificationController = {
  getNotifications,
  getUnreadSummary,
  getNotificationById,
  markNotificationAsRead,
  markNotificationAsUnread,
  markAllNotificationsAsRead,
  archiveNotification,
  deleteNotification,
  getNotificationPreferences,
  updateNotificationPreferences,
};
