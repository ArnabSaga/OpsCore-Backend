import { NextFunction, Request, Response } from "express";
import status from "http-status";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth";
import { prisma } from "../lib/prisma";
import AppError from "../errors/AppError";
import { WorkspaceMemberStatus } from "../../generated/prisma/enums";
import { SystemRole, WorkspaceMemberRole } from "../constants/role";

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

    // Accept workspace ID from route parameter or custom header
    const requestedWorkspaceId = 
      (req.params.workspaceId as string | undefined) ?? 
      (req.headers["x-workspace-id"] as string | undefined);
      
    const resolvedWorkspaceId = requestedWorkspaceId ?? dbSession.activeWorkspaceId;

    if (!resolvedWorkspaceId) {
      if (req.user.systemRole === SystemRole.SUPER_ADMIN || String(req.user.systemRole) === "SUPER_ADMIN") {
        return next();
      }

      throw new AppError(
        status.BAD_REQUEST,
        "No active workspace selected. Please switch to a workspace first"
      );
    }

    // Try to find membership
    const membership = await prisma.workspaceMember.findFirst({
      where: {
        userId: req.user.id,
        workspaceId: resolvedWorkspaceId,
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
            name: true,
            deletedAt: true,
          },
        },
      },
    });

    // If no membership but user is Super Admin, allow access with OWNER role
    if (!membership && (req.user.systemRole === SystemRole.SUPER_ADMIN || String(req.user.systemRole) === "SUPER_ADMIN")) {
      const workspace = await prisma.workspace.findUnique({
        where: { id: resolvedWorkspaceId, deletedAt: null },
      });

      if (!workspace) {
        throw new AppError(status.NOT_FOUND, "Workspace not found");
      }

      req.workspaceId = workspace.id;
      req.workspaceRole = WorkspaceMemberRole.OWNER; 
      
      return next();
    }

    if (!membership) {
      throw new AppError(status.FORBIDDEN, "You do not belong to this workspace");
    }

    if (membership.workspace.deletedAt) {
      throw new AppError(status.NOT_FOUND, "Workspace no longer exists");
    }

    if (membership.status !== WorkspaceMemberStatus.ACTIVE) {
      throw new AppError(status.FORBIDDEN, "Your workspace membership is not active");
    }

    if (requestedWorkspaceId && dbSession.activeWorkspaceId !== requestedWorkspaceId) {
      await prisma.session.update({
        where: { id: dbSession.id },
        data: { activeWorkspaceId: requestedWorkspaceId },
      });
    }

    req.workspaceId = membership.workspaceId;
    req.workspaceRole = membership.role;
    req.workspaceMembership = {
      id: membership.id,
      workspaceId: membership.workspaceId,
      userId: membership.userId,
      role: membership.role,
      status: membership.status,
    };

    next();
  } catch (error) {
    next(error);
  }
};
