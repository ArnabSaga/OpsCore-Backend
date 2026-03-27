import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { WorkspaceMemberService } from "./workspaceMember.service";

const getMembers = catchAsync(async (req: Request, res: Response) => {
  const result = await WorkspaceMemberService.getMembers(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Members fetched successfully",
    data: result,
  });
});

const updateMember = catchAsync(async (req: Request, res: Response) => {
  const result = await WorkspaceMemberService.updateMember(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Member updated successfully",
    data: result,
  });
});

const removeMember = catchAsync(async (req: Request, res: Response) => {
  await WorkspaceMemberService.removeMember(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Member removed successfully",
  });
});

const transferOwnership = catchAsync(async (req: Request, res: Response) => {
  await WorkspaceMemberService.transferOwnership(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Ownership transferred successfully",
  });
});

export const WorkspaceMemberController = {
  getMembers,
  updateMember,
  removeMember,
  transferOwnership,
};
