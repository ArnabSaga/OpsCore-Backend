import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { TaskService } from "./task.service";

const getTasks = catchAsync(async (req: Request, res: Response) => {
  const result = await TaskService.getTasks(req);

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

export const TaskController = {
  getTasks,
  createTask,
  getTask,
  updateTask,
  deleteTask,
};
