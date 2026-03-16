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

const getMembers = catchAsync(async (req: Request, res: Response) => {
  const result = await WorkspaceService.getMembers(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Members fetched successfully",
    data: result,
  });
});

const updateMember = catchAsync(async (req: Request, res: Response) => {
  const result = await WorkspaceService.updateMember(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Member updated successfully",
    data: result,
  });
});

const removeMember = catchAsync(async (req: Request, res: Response) => {
  await WorkspaceService.removeMember(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Member removed successfully",
  });
});

export const WorkspaceController = {
  getMyWorkspaces,
  createWorkspace,
  getWorkspace,
  updateWorkspace,
  switchWorkspace,
  deleteWorkspace,
  getMembers,
  updateMember,
  removeMember,
};
