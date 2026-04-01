import { fromNodeHeaders } from "better-auth/node";
import { Request } from "express";
import status from "http-status";
import { WorkspaceMemberRole, WorkspaceMemberStatus } from "../../constants/role";
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
  ISwitchWorkspacePayload,
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
  const { name, email, password, workspaceName } = req.body as IRegisterPayload;
  const normalizedEmail = email.trim().toLowerCase();

  let authResponse: globalThis.Response | null = null;

  try {
    console.log("[AUTH][REGISTER] Starting registration for:", normalizedEmail);

    authResponse = await auth.api.signUpEmail({
      body: {
        name: name.trim(),
        email: normalizedEmail,
        password,
        systemRole: "USER",
        isActive: true,
        isDeleted: false,
      },
      headers: fromNodeHeaders(req.headers),
      asResponse: true,
    });

    await throwIfFailed(authResponse, "Registration failed");

    console.log("[AUTH][REGISTER] Better Auth signup succeeded for:", normalizedEmail);

    const createdUser = await prisma.user.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        emailVerified: true,
        isActive: true,
        isDeleted: true,
        systemRole: true,
      },
    });

    if (!createdUser) {
      console.error("[AUTH][REGISTER] User was not found in DB after sign up:", normalizedEmail);
      throw new AppError(
        status.INTERNAL_SERVER_ERROR,
        "User was created but could not be loaded from the database."
      );
    }

    console.log("[AUTH][REGISTER] User found in DB:", {
      id: createdUser.id,
      email: createdUser.email,
      emailVerified: createdUser.emailVerified,
    });

    const existingMembership = await prisma.workspaceMember.findFirst({
      where: { userId: createdUser.id },
      select: { workspaceId: true },
    });

    let workspace: {
      id: string;
      name: string;
      slug: string;
    } | null = null;

    if (existingMembership?.workspaceId) {
      workspace = await prisma.workspace.findUnique({
        where: { id: existingMembership.workspaceId },
        select: { id: true, name: true, slug: true },
      });

      console.log("[AUTH][REGISTER] Existing workspace membership found:", workspace?.id);
    }

    if (!workspace) {
      const safeWorkspaceName = workspaceName.trim();
      const slug = await generateUniqueWorkspaceSlug(safeWorkspaceName);

      console.log("[AUTH][REGISTER] Creating workspace:", {
        userId: createdUser.id,
        workspaceName: safeWorkspaceName,
        slug,
      });

      workspace = await prisma.$transaction(async (tx) => {
        const createdWorkspace = await tx.workspace.create({
          data: {
            name: safeWorkspaceName,
            slug,
            createdByUserId: createdUser.id,
          },
          select: {
            id: true,
            name: true,
            slug: true,
          },
        });

        await tx.workspaceMember.create({
          data: {
            workspaceId: createdWorkspace.id,
            userId: createdUser.id,
            role: WorkspaceMemberRole.OWNER,
            status: WorkspaceMemberStatus.ACTIVE,
            addedByUserId: createdUser.id,
          },
        });

        return createdWorkspace;
      });

      console.log("[AUTH][REGISTER] Workspace created successfully:", workspace.id);
    }

    // FORCE SEND EMAIL VERIFICATION OTP
    if (!createdUser.emailVerified) {
      console.log("[AUTH][REGISTER] Sending verification OTP manually to:", normalizedEmail);

      const otpResponse = await auth.api.sendVerificationOTP({
        body: {
          email: normalizedEmail,
          type: "email-verification",
        },
        headers: fromNodeHeaders(req.headers),
        asResponse: true,
      });

      await throwIfFailed(otpResponse, "Failed to send verification OTP");

      console.log("[AUTH][REGISTER] Verification OTP request completed for:", normalizedEmail);
    }

    return {
      authResponse,
      user: {
        id: createdUser.id,
        name: createdUser.name,
        email: createdUser.email,
        image: createdUser.image ?? null,
        emailVerified: createdUser.emailVerified ?? false,
        systemRole: String(createdUser.systemRole),
        isActive: createdUser.isActive,
        isDeleted: createdUser.isDeleted,
      },
      workspace,
    };
  } catch (error) {
    console.error("[AUTH][REGISTER] Registration flow failed:", error);

    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(status.INTERNAL_SERVER_ERROR, "Registration failed");
  }
};

const login = async (req: Request): Promise<ILoginServiceResponse> => {
  try {
    const { email, password } = req.body as ILoginPayload;

    const response = await auth.api.signInEmail({
      body: {
        email,
        password,
      },
      headers: fromNodeHeaders(req.headers),
      asResponse: true,
    });

    await throwIfFailed(response, "Login failed");

    const data = (await response.clone().json()) as {
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
            status: WorkspaceMemberStatus.ACTIVE,
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

    const activeWorkspaceId = session?.session?.id
      ? ((
          await prisma.session.findUnique({
            where: { id: session.session.id },
            select: { activeWorkspaceId: true },
          })
        )?.activeWorkspaceId ?? null)
      : null;

    const activeWorkspace = activeWorkspaceId
      ? user.workspaceMembers.find((m) => m.workspace.id === activeWorkspaceId)?.workspace
      : null;

    return {
      ...user,
      systemRole: String(user.systemRole),
      activeWorkspaceId,
      activeWorkspace: activeWorkspace
        ? {
            id: activeWorkspace.id,
            name: activeWorkspace.name,
            slug: activeWorkspace.slug,
          }
        : null,
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
    const normalizedEmail = email.trim().toLowerCase();

    const user = await prisma.user.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
        isActive: true,
        isDeleted: true,
      },
    });

    if (!user || user.isDeleted || !user.isActive) {
      console.warn(
        `[AUTH][FORGOT_PASSWORD] Reset requested for unavailable account: ${normalizedEmail}`
      );
      return;
    }

    const response = await auth.api.requestPasswordResetEmailOTP({
      body: {
        email: normalizedEmail,
      },
      headers: fromNodeHeaders(req.headers),
      asResponse: true,
    });

    await throwIfFailed(response, "Failed to send password reset OTP");
  } catch (error: any) {
    console.error("[AUTH][FORGOT_PASSWORD] flow failed:", error);
    if (error instanceof AppError) throw error;

    throw new AppError(
      status.INTERNAL_SERVER_ERROR,
      error?.message || "Failed to send password reset OTP"
    );
  }
};

const resetPassword = async (req: Request): Promise<void> => {
  try {
    const { email, otp, newPassword } = req.body as IResetPasswordPayload;

    await auth.api.resetPasswordEmailOTP({
      body: {
        email: email.trim().toLowerCase(),
        otp: otp.trim(),
        password: newPassword,
      },
      headers: fromNodeHeaders(req.headers),
    });
  } catch (error: any) {
    console.error("Reset password flow failed:", error);
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
        email: email.trim().toLowerCase(),
        otp: otp.trim(),
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
    const normalizedEmail = email.trim().toLowerCase();

    const user = await prisma.user.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: "insensitive",
        },
      },
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
        email: normalizedEmail,
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

const googleLoginSuccess = async (session: Record<string, any>) => {
  const userId = session.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, isActive: true, isDeleted: true },
  });

  if (!user) {
    throw new AppError(status.NOT_FOUND, "User not found after OAuth");
  }

  if (user.isDeleted) {
    throw new AppError(status.FORBIDDEN, "User account is deleted");
  }

  if (!user.isActive) {
    throw new AppError(status.FORBIDDEN, "User account is inactive");
  }

  const existingMembership = await prisma.workspaceMember.findFirst({
    where: { userId },
  });

  if (!existingMembership) {
    const workspaceName = `${user.name}'s Workspace`;
    const slug = await generateUniqueWorkspaceSlug(workspaceName);

    await prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: { name: workspaceName, slug, createdByUserId: userId },
      });

      await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId,
          role: WorkspaceMemberRole.OWNER,
          status: WorkspaceMemberStatus.ACTIVE,
          addedByUserId: userId,
        },
      });
    });
  }

  const sessionData = await auth.api.getSession({
    headers: fromNodeHeaders({
      cookie: `better-auth.session_token=${session.session.sessionToken}`,
    }),
  });

  if (sessionData?.session?.id) {
    const finalMembership = await prisma.workspaceMember.findFirst({
      where: { userId, status: WorkspaceMemberStatus.ACTIVE },
      select: { workspaceId: true },
    });

    if (finalMembership) {
      await prisma.session.update({
        where: { id: sessionData.session.id },
        data: { activeWorkspaceId: finalMembership.workspaceId },
      });
    }
  }
};

const switchWorkspace = async (
  req: Request
): Promise<{ workspaceId: string; workspaceName: string; role: string }> => {
  try {
    const { workspaceId } = req.body as ISwitchWorkspacePayload;

    const sessionData = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!sessionData?.session) {
      throw new AppError(status.UNAUTHORIZED, "Session not found");
    }

    const membership = await prisma.workspaceMember.findFirst({
      where: {
        userId: req.user!.id,
        workspaceId,
        status: WorkspaceMemberStatus.ACTIVE,
      },
      select: {
        role: true,
        workspace: {
          select: { id: true, name: true, deletedAt: true },
        },
      },
    });

    if (!membership) {
      throw new AppError(status.FORBIDDEN, "You are not an active member of this workspace");
    }

    if (membership.workspace.deletedAt) {
      throw new AppError(status.NOT_FOUND, "Workspace no longer exists");
    }

    await prisma.session.update({
      where: { id: sessionData.session.id },
      data: { activeWorkspaceId: workspaceId },
    });

    return {
      workspaceId: membership.workspace.id,
      workspaceName: membership.workspace.name,
      role: String(membership.role),
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to switch workspace");
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
  googleLoginSuccess,
  switchWorkspace,
};
