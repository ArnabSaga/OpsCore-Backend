import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { UserService } from "./user.service";

const getProfile = catchAsync(async (req: Request, res: Response) => {
  const result = await UserService.getProfile(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Profile fetched successfully",
    data: result,
  });
});

const updateProfile = catchAsync(async (req: Request, res: Response) => {
  const result = await UserService.updateProfile(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Profile updated successfully",
    data: result,
  });
});

const updatePassword = catchAsync(async (req: Request, res: Response) => {
  await UserService.updatePassword(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Password updated successfully",
  });
});

export const UserController = {
  getProfile,
  updateProfile,
  updatePassword,
};
