import { fromNodeHeaders } from "better-auth/node";
import { Request } from "express";
import status from "http-status";
import AppError from "../../errors/AppError";
import { auth } from "../../lib/auth";
import { prisma } from "../../lib/prisma";
import { generateSlug } from "../../utils/generateSlug";
import {
  IChangePasswordPayload,
  IForgotPasswordPayload,
  ILoginPayload,
  ILoginServiceResponse,
  ILogoutServiceResponse,
  IMeResponse,
  IRegisterPayload,
  IRegisterServiceResponse,
  IResendVerificationPayload,
  IResetPasswordPayload,
  IVerifyEmailPayload,
} from "./auth.interface";

const throwIfFailed = async (response: globalThis.Response, fallbackMsg: string): Promise<void> => {
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);

    const message = (errorBody as { message?: string } | null)?.message ?? fallbackMsg;

    throw new AppError(response.status || status.BAD_REQUEST, message);
  }
};

const generateUniqueWorkspaceSlug = async (workspaceName: string): Promise<string> => {
  const baseSlug = generateSlug(workspaceName);
  let slug = baseSlug;
  let counter = 1;

  while (await prisma.workspace.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
};

const register = async (req: Request): Promise<IRegisterServiceResponse> => {
  try {
    const { name, email, password, workspaceName } = req.body as IRegisterPayload;

    const response = await auth.api.signUpEmail({
      body: {
        name,
        email,
        password,
        systemRole: "USER",
        isActive: true,
      },
      headers: fromNodeHeaders(req.headers),
      asResponse: true,
    });

    await throwIfFailed(response, "Registration failed");

    const data = (await response.json()) as {
      user: {
        id: string;
        name: string;
        email: string;
        image?: string | null;
        emailVerified?: boolean;
      };
    };

    const userId = data.user.id;
    const slug = await generateUniqueWorkspaceSlug(workspaceName);

    try {
      const workspace = await prisma.$transaction(async (tx) => {
        const createdWorkspace = await tx.workspace.create({
          data: {
            name: workspaceName,
            slug,
            createdByUserId: userId,
          },
          select: {
            id: true,
            name: true,
            slug: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        await tx.workspaceMember.create({
          data: {
            workspaceId: createdWorkspace.id,
            userId,
            role: "OWNER",
            status: "ACTIVE",
            addedByUserId: userId,
          },
        });

        return createdWorkspace;
      });

      return {
        authResponse: response,
        user: data.user,
        workspace,
      };
    } catch {
      throw new AppError(
        status.INTERNAL_SERVER_ERROR,
        "User was created but workspace setup failed. Please contact support or retry."
      );
    }
  } catch (error) {
    if (error instanceof AppError) throw error;

    throw new AppError(status.INTERNAL_SERVER_ERROR, "Registration failed");
  }
};

const login = async (req: Request): Promise<ILoginServiceResponse> => {
  try {
    const { email, password } = req.body as ILoginPayload;

    const response = await auth.api.signInEmail({
      body: { email, password },
      headers: fromNodeHeaders(req.headers),
      asResponse: true,
    });

    await throwIfFailed(response, "Invalid credentials");

    const data = (await response.json()) as {
      user: {
        id: string;
        name: string;
        email: string;
        image?: string | null;
        emailVerified?: boolean;
      };
    };

    const dbUser = await prisma.user.findUnique({
      where: { id: data.user.id },
      select: {
        id: true,
        isActive: true,
        isDeleted: true,
        systemRole: true,
      },
    });

    if (!dbUser) {
      throw new AppError(status.NOT_FOUND, "User not found");
    }

    if (dbUser.isDeleted) {
      throw new AppError(status.FORBIDDEN, "User account is deleted");
    }

    if (!dbUser.isActive) {
      throw new AppError(status.FORBIDDEN, "User account is inactive");
    }

    return {
      authResponse: response,
      user: {
        ...data.user,
        isActive: dbUser.isActive,
        isDeleted: dbUser.isDeleted,
        systemRole: String(dbUser.systemRole),
      },
    };
  } catch (error) {
    if (error instanceof AppError) throw error;

    throw new AppError(status.INTERNAL_SERVER_ERROR, "Login failed");
  }
};

const logout = async (req: Request): Promise<ILogoutServiceResponse> => {
  try {
    const response = await auth.api.signOut({
      headers: fromNodeHeaders(req.headers),
      asResponse: true,
    });

    await throwIfFailed(response, "Logout failed");

    return {
      authResponse: response,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;

    throw new AppError(status.INTERNAL_SERVER_ERROR, "Logout failed");
  }
};

const getMe = async (req: Request): Promise<IMeResponse> => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session?.user) {
      throw new AppError(status.UNAUTHORIZED, "Not authenticated");
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        image: true,
        systemRole: true,
        isActive: true,
        createdAt: true,
        workspaceMembers: {
          where: {
            status: "ACTIVE",
            workspace: {
              deletedAt: null,
            },
          },
          select: {
            role: true,
            status: true,
            workspace: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new AppError(status.NOT_FOUND, "User not found");
    }

    return {
      ...user,
      systemRole: String(user.systemRole),
      workspaceMembers: user.workspaceMembers.map((member) => ({
        ...member,
        role: String(member.role),
        status: String(member.status),
      })),
    };
  } catch (error) {
    if (error instanceof AppError) throw error;

    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to fetch user");
  }
};

const forgotPassword = async (req: Request): Promise<void> => {
  try {
    const { email } = req.body as IForgotPasswordPayload;

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        isActive: true,
        isDeleted: true,
      },
    });

    if (!user || user.isDeleted || !user.isActive) {
      return;
    }

    const response = await auth.api.forgetPasswordEmailOTP({
      body: {
        email,
      },
      headers: fromNodeHeaders(req.headers),
      asResponse: true,
    });

    await throwIfFailed(response, "Failed to send password reset OTP");
  } catch (error) {
    if (error instanceof AppError) throw error;

    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to send password reset OTP");
  }
};

const resetPassword = async (req: Request): Promise<void> => {
  try {
    const { email, otp, newPassword } = req.body as IResetPasswordPayload;

    await auth.api.resetPasswordEmailOTP({
      body: {
        email,
        otp,
        password: newPassword,
      },
      headers: fromNodeHeaders(req.headers),
    });
  } catch (error: any) {
    if (error instanceof AppError) throw error;

    throw new AppError(status.BAD_REQUEST, error?.message || "Password reset failed");
  }
};

const changePassword = async (req: Request): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body as IChangePasswordPayload;

    const response = await auth.api.changePassword({
      body: {
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      },
      headers: fromNodeHeaders(req.headers),
      asResponse: true,
    });

    await throwIfFailed(response, "Password change failed");
  } catch (error) {
    if (error instanceof AppError) throw error;

    throw new AppError(status.INTERNAL_SERVER_ERROR, "Password change failed");
  }
};

const verifyEmail = async (req: Request): Promise<void> => {
  try {
    const { email, otp } = req.body as IVerifyEmailPayload;

    await auth.api.verifyEmailOTP({
      body: {
        email,
        otp,
      },
      headers: fromNodeHeaders(req.headers),
    });
  } catch (error: any) {
    if (error instanceof AppError) throw error;

    throw new AppError(status.BAD_REQUEST, error?.message || "Email verification failed");
  }
};

const resendVerification = async (req: Request): Promise<void> => {
  try {
    const { email } = req.body as IResendVerificationPayload;

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        emailVerified: true,
        isActive: true,
        isDeleted: true,
      },
    });

    if (!user) {
      throw new AppError(status.NOT_FOUND, "User not found");
    }

    if (user.isDeleted) {
      throw new AppError(status.FORBIDDEN, "User account is deleted");
    }

    if (!user.isActive) {
      throw new AppError(status.FORBIDDEN, "User account is inactive");
    }

    if (user.emailVerified) {
      throw new AppError(status.BAD_REQUEST, "Email is already verified");
    }

    const response = await auth.api.sendVerificationOTP({
      body: {
        email,
        type: "email-verification",
      },
      headers: fromNodeHeaders(req.headers),
      asResponse: true,
    });

    await throwIfFailed(response, "Failed to resend verification OTP");
  } catch (error) {
    if (error instanceof AppError) throw error;

    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to resend verification OTP");
  }
};

export const AuthService = {
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
