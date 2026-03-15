import { NextFunction, Request, Response } from "express";
import status from "http-status";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth";
import { prisma } from "../lib/prisma";
import AppError from "../errors/AppError";

export const workspaceContext = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError(
        status.UNAUTHORIZED,
        "Authentication is required before workspace resolution"
      );
    }

    const sessionData = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!sessionData?.session) {
      throw new AppError(status.UNAUTHORIZED, "Session not found");
    }

    const dbSession = await prisma.session.findFirst({
      where: {
        id: sessionData.session.id,
        userId: req.user.id,
      },
      select: {
        id: true,
        userId: true,
        activeWorkspaceId: true,
      },
    });

    if (!dbSession) {
      throw new AppError(status.UNAUTHORIZED, "Session not found in database");
    }

    if (!dbSession.activeWorkspaceId) {
      throw new AppError(
        status.BAD_REQUEST,
        "No active workspace selected. Please switch to a workspace first"
      );
    }

    const membership = await prisma.workspaceMember.findFirst({
      where: {
        userId: req.user.id,
        workspaceId: dbSession.activeWorkspaceId,
      },
      select: {
        id: true,
        workspaceId: true,
        userId: true,
        role: true,
        status: true,
        workspace: {
          select: {
            id: true,
            deletedAt: true,
          },
        },
      },
    });

    if (!membership) {
      throw new AppError(status.FORBIDDEN, "You do not belong to the active workspace");
    }

    if (membership.workspace.deletedAt) {
      throw new AppError(status.NOT_FOUND, "Workspace no longer exists");
    }

    if (String(membership.status) !== "ACTIVE") {
      throw new AppError(status.FORBIDDEN, "Your workspace membership is not active");
    }

    req.workspaceId = membership.workspaceId;
    req.workspaceRole = String(membership.role);
    req.workspaceMembership = {
      id: membership.id,
      workspaceId: membership.workspaceId,
      userId: membership.userId,
      role: String(membership.role),
      status: String(membership.status),
    };

    next();
  } catch (error) {
    next(error);
  }
};
