import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { pick } from "../../utils/pick";
import { TaskService } from "./task.service";

const getTasks = catchAsync(async (req: Request, res: Response) => {
  const query = pick(req.query as any, [
    "searchTerm",
    "projectId",
    "assignedToUserId",
    "assignedToMe",
    "status",
    "priority",
    "overdue",
    "dueFrom",
    "dueTo",
    "page",
    "limit",
    "sortBy",
    "sortOrder",
  ]);

  const result = await TaskService.getTasks(
    req.workspaceId!,
    req.workspaceRole!,
    req.user!.id,
    query
  );

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Tasks fetched successfully",
    data: result.data,
    meta: result.meta,
  });
});

const createTask = catchAsync(async (req: Request, res: Response) => {
  const result = await TaskService.createTask(req);

  sendResponse(res, {
    statusCode: status.CREATED,
    success: true,
    message: "Task created successfully",
    data: result,
  });
});

const getTask = catchAsync(async (req: Request, res: Response) => {
  const result = await TaskService.getTask(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Task fetched successfully",
    data: result,
  });
});

const updateTask = catchAsync(async (req: Request, res: Response) => {
  const result = await TaskService.updateTask(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Task updated successfully",
    data: result,
  });
});

const deleteTask = catchAsync(async (req: Request, res: Response) => {
  await TaskService.deleteTask(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Task deleted successfully",
  });
});

const getTaskComments = catchAsync(async (req: Request, res: Response) => {
  const query = pick(req.query as any, ["page", "limit"]);

  const result = await TaskService.getTaskComments(
    req.workspaceId!,
    req.workspaceRole!,
    req.user!.id,
    req.params.taskId as string,
    query
  );

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Task comments fetched successfully",
    data: result.data,
    meta: result.meta,
  });
});

const createTaskComment = catchAsync(async (req: Request, res: Response) => {
  const result = await TaskService.createTaskComment(req);

  sendResponse(res, {
    statusCode: status.CREATED,
    success: true,
    message: "Task comment created successfully",
    data: result,
  });
});

const updateTaskComment = catchAsync(async (req: Request, res: Response) => {
  const result = await TaskService.updateTaskComment(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Task comment updated successfully",
    data: result,
  });
});

const deleteTaskComment = catchAsync(async (req: Request, res: Response) => {
  await TaskService.deleteTaskComment(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Task comment deleted successfully",
  });
});

const getTaskAttachments = catchAsync(async (req: Request, res: Response) => {
  const query = pick(req.query as any, ["page", "limit"]);

  const result = await TaskService.getTaskAttachments(
    req.workspaceId!,
    req.workspaceRole!,
    req.user!.id,
    req.params.taskId as string,
    query
  );

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Task attachments fetched successfully",
    data: result.data,
    meta: result.meta,
  });
});

const uploadTaskAttachment = catchAsync(async (req: Request, res: Response) => {
  const result = await TaskService.createTaskAttachment(req);

  sendResponse(res, {
    statusCode: status.CREATED,
    success: true,
    message: "Task attachment uploaded successfully",
    data: result,
  });
});

const deleteTaskAttachment = catchAsync(async (req: Request, res: Response) => {
  await TaskService.deleteTaskAttachment(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Task attachment deleted successfully",
  });
});

export const TaskController = {
  getTasks,
  createTask,
  getTask,
  updateTask,
  deleteTask,
  getTaskComments,
  createTaskComment,
  updateTaskComment,
  deleteTaskComment,
  getTaskAttachments,
  uploadTaskAttachment,
  deleteTaskAttachment,
};
