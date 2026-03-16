import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { ProjectService } from "./project.service";

const getProjects = catchAsync(async (req: Request, res: Response) => {
  const result = await ProjectService.getProjects(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Projects fetched successfully",
    data: result.data,
    meta: result.meta,
  });
});

const createProject = catchAsync(async (req: Request, res: Response) => {
  const result = await ProjectService.createProject(req);

  sendResponse(res, {
    statusCode: status.CREATED,
    success: true,
    message: "Project created successfully",
    data: result,
  });
});

const getProject = catchAsync(async (req: Request, res: Response) => {
  const result = await ProjectService.getProject(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Project fetched successfully",
    data: result,
  });
});

const updateProject = catchAsync(async (req: Request, res: Response) => {
  const result = await ProjectService.updateProject(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Project updated successfully",
    data: result,
  });
});

const deleteProject = catchAsync(async (req: Request, res: Response) => {
  await ProjectService.deleteProject(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Project deleted successfully",
  });
});

const getProjectTasks = catchAsync(async (req: Request, res: Response) => {
  const result = await ProjectService.getProjectTasks(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Project tasks fetched successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getProjectMembers = catchAsync(async (req: Request, res: Response) => {
  const result = await ProjectService.getProjectMembers(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Project members fetched successfully",
    data: result,
  });
});

const assignProjectMembers = catchAsync(async (req: Request, res: Response) => {
  const result = await ProjectService.assignProjectMembers(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Project members assigned successfully",
    data: result,
  });
});

export const ProjectController = {
  getProjects,
  createProject,
  getProject,
  updateProject,
  deleteProject,
  getProjectTasks,
  getProjectMembers,
  assignProjectMembers,
};
