import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { WorkspaceService } from "./workspace.service";

const getMyWorkspaces = catchAsync(async (req: Request, res: Response) => {
  const result = await WorkspaceService.getMyWorkspaces(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Workspaces fetched successfully",
    data: result,
  });
});

const createWorkspace = catchAsync(async (req: Request, res: Response) => {
  const result = await WorkspaceService.createWorkspace(req);

  sendResponse(res, {
    statusCode: status.CREATED,
    success: true,
    message: "Workspace created successfully",
    data: result,
  });
});

const getWorkspace = catchAsync(async (req: Request, res: Response) => {
  const result = await WorkspaceService.getWorkspace(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Workspace fetched successfully",
    data: result,
  });
});

const updateWorkspace = catchAsync(async (req: Request, res: Response) => {
  const result = await WorkspaceService.updateWorkspace(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Workspace updated successfully",
    data: result,
  });
});

const switchWorkspace = catchAsync(async (req: Request, res: Response) => {
  const result = await WorkspaceService.switchWorkspace(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Workspace switched successfully",
    data: result,
  });
});

const deleteWorkspace = catchAsync(async (req: Request, res: Response) => {
  await WorkspaceService.deleteWorkspace(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Workspace deleted successfully",
  });
});

const getGeneralSettings = catchAsync(async (req: Request, res: Response) => {
  const result = await WorkspaceService.getGeneralSettings(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "General settings fetched successfully",
    data: result,
  });
});

const updateGeneralSettings = catchAsync(async (req: Request, res: Response) => {
  const result = await WorkspaceService.updateGeneralSettings(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "General settings updated successfully",
    data: result,
  });
});

const getBranding = catchAsync(async (req: Request, res: Response) => {
  const result = await WorkspaceService.getBranding(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Branding settings fetched successfully",
    data: result,
  });
});

const updateBranding = catchAsync(async (req: Request, res: Response) => {
  const result = await WorkspaceService.updateBranding(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Branding settings updated successfully",
    data: result,
  });
});

const getSummary = catchAsync(async (req: Request, res: Response) => {
  const result = await WorkspaceService.getSummary(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Settings summary fetched successfully",
    data: result,
  });
});

const getCapabilities = catchAsync(async (req: Request, res: Response) => {
  const result = await WorkspaceService.getCapabilities(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Capabilities fetched successfully",
    data: result,
  });
});

const getPermissions = catchAsync(async (req: Request, res: Response) => {
  const result = await WorkspaceService.getPermissions(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Permissions fetched successfully",
    data: result,
  });
});

const archiveWorkspace = catchAsync(async (req: Request, res: Response) => {
  await WorkspaceService.archiveWorkspace(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Workspace archived successfully",
  });
});

const getActivityLogs = catchAsync(async (req: Request, res: Response) => {
  const result = await WorkspaceService.getActivityLogs(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Activity logs fetched successfully",
    data: result,
  });
});

const getPlatformWorkspaces = catchAsync(async (req: Request, res: Response) => {
  const result = await WorkspaceService.getPlatformWorkspaces(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Platform workspaces fetched successfully",
    data: result,
  });
});

export const WorkspaceController = {
  getMyWorkspaces,
  getPlatformWorkspaces,
  createWorkspace,
  getWorkspace,
  updateWorkspace,
  switchWorkspace,
  deleteWorkspace,
  archiveWorkspace,
  getGeneralSettings,
  updateGeneralSettings,
  getBranding,
  updateBranding,
  getSummary,
  getCapabilities,
  getPermissions,
  getActivityLogs,
};
