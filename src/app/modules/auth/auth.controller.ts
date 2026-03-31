import { fromNodeHeaders } from "better-auth/node";
import { Request, Response } from "express";
import status from "http-status";
import { envVars } from "../../config/env";
import { auth } from "../../lib/auth";
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
    message: "Password reset OTP sent to your email",
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
    message: "Verification OTP resent successfully",
  });
});

const googleLogin = catchAsync(async (req: Request, res: Response) => {
  const redirectPath = (req.query.redirect as string) || "/dashboard";
  const encodedRedirectPath = encodeURIComponent(redirectPath);

  const callbackURL = `${envVars.BETTER_AUTH_URL}/api/v1/auth/google/success?redirect=${encodedRedirectPath}`;

  res.render("googleRedirect", {
    callbackURL,
    betterAuthUrl: envVars.BETTER_AUTH_URL,
  });
});

const googleLoginSuccess = catchAsync(async (req: Request, res: Response) => {
  const redirectPath = (req.query.redirect as string) || "/dashboard";

  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session) {
      return res.redirect(`${envVars.FRONTEND_URL}/login?error=no_session_found`);
    }

    if (!session.user) {
      return res.redirect(`${envVars.FRONTEND_URL}/login?error=no_user_found`);
    }

    await AuthService.googleLoginSuccess(session);

    const isValidRedirectPath = redirectPath.startsWith("/") && !redirectPath.startsWith("//");

    const finalRedirectPath = isValidRedirectPath ? redirectPath : "/dashboard";

    res.redirect(`${envVars.FRONTEND_URL}${finalRedirectPath}`);
  } catch (error: any) {
    const message = error.message || "oauth_failed";
    res.redirect(`${envVars.FRONTEND_URL}/login?error=${encodeURIComponent(message)}`);
  }
});

const handleOAuthError = catchAsync(async (req: Request, res: Response) => {
  const error = (req.query.error as string) || "oauth_failed";

  res.redirect(`${envVars.FRONTEND_URL}/login?error=${encodeURIComponent(error)}`);
});

const switchWorkspace = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthService.switchWorkspace(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Workspace switched successfully",
    data: result,
  });
});

const handleRegisterGet = catchAsync(async (_req: Request, res: Response) => {
  const frontendUrl = envVars.FRONTEND_URL;

  if (!frontendUrl) {
    return sendResponse(res, {
      statusCode: status.INTERNAL_SERVER_ERROR,
      success: false,
      message: "Frontend URL is not configured. Please contact support.",
    });
  }

  const normalizedUrl = frontendUrl.endsWith("/") ? frontendUrl.slice(0, -1) : frontendUrl;

  res.redirect(status.FOUND, `${normalizedUrl}/register`);
});

const handleLoginGet = catchAsync(async (_req: Request, res: Response) => {
  const frontendUrl = envVars.FRONTEND_URL;

  if (!frontendUrl) {
    return sendResponse(res, {
      statusCode: status.INTERNAL_SERVER_ERROR,
      success: false,
      message: "Frontend URL is not configured. Please contact support.",
    });
  }

  const normalizedUrl = frontendUrl.endsWith("/") ? frontendUrl.slice(0, -1) : frontendUrl;

  res.redirect(status.FOUND, `${normalizedUrl}/login`);
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
  googleLogin,
  googleLoginSuccess,
  handleOAuthError,
  switchWorkspace,
  handleRegisterGet,
  handleLoginGet,
};
