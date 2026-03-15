import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { AuthService } from "./auth.service";
import { forwardAuthCookies } from "./auth.utils";

const register = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthService.register(req);

  forwardAuthCookies(result.authResponse, res);

  sendResponse(res, {
    statusCode: status.CREATED,
    success: true,
    message: "Registered successfully. Please verify your email.",
    data: {
      user: result.user,
      workspace: result.workspace,
    },
  });
});

const login = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthService.login(req);

  forwardAuthCookies(result.authResponse, res);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Logged in successfully",
    data: {
      user: result.user,
    },
  });
});

const logout = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthService.logout(req);

  forwardAuthCookies(result.authResponse, res);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Logged out successfully",
  });
});

const getMe = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthService.getMe(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "User fetched successfully",
    data: result,
  });
});

const forgotPassword = catchAsync(async (req: Request, res: Response) => {
  await AuthService.forgotPassword(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Password reset link sent to your email",
  });
});

const resetPassword = catchAsync(async (req: Request, res: Response) => {
  await AuthService.resetPassword(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Password reset successfully",
  });
});

const changePassword = catchAsync(async (req: Request, res: Response) => {
  await AuthService.changePassword(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Password changed successfully",
  });
});

const verifyEmail = catchAsync(async (req: Request, res: Response) => {
  await AuthService.verifyEmail(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Email verified successfully",
  });
});

const resendVerification = catchAsync(async (req: Request, res: Response) => {
  await AuthService.resendVerification(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Verification email resent successfully",
  });
});

export const AuthController = {
  register,
  login,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
  changePassword,
  verifyEmail,
  resendVerification,
};
