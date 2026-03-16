import crypto from "crypto";
import { Request } from "express";
import status from "http-status";
import {
  InvitationStatus,
  WorkspaceMemberRole,
  WorkspaceMemberStatus,
} from "../../../generated/prisma/enums";
import AppError from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import {
  IAcceptInvitationResponse,
  ICreateInvitationPayload,
  IInvitationResponse,
} from "./invitation.interface";

const INVITATION_EXPIRY_DAYS = 7;

const markExpiredPendingInvitations = async (
  workspaceId: string,
  email?: string
): Promise<void> => {
  await prisma.workspaceInvitation.updateMany({
    where: {
      workspaceId,
      status: InvitationStatus.PENDING,
      expiresAt: { lt: new Date() },
      ...(email ? { email } : {}),
    },
    data: {
      status: InvitationStatus.EXPIRED,
    },
  });
};

const getInvitations = async (req: Request): Promise<IInvitationResponse[]> => {
  try {
    const workspaceId = req.params.workspaceId as string;

    await markExpiredPendingInvitations(workspaceId);

    const invitations = await prisma.workspaceInvitation.findMany({
      where: { workspaceId },
      include: {
        invitedBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return invitations.map((invitation) => ({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
      invitedBy: invitation.invitedBy,
    }));
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to fetch invitations");
  }
};

const createInvitation = async (req: Request): Promise<IInvitationResponse> => {
  try {
    const workspaceId = req.params.workspaceId as string;
    const invitedById = req.user!.id;
    const requesterEmail = req.user!.email.toLowerCase();
    const payload = req.body as ICreateInvitationPayload;

    const email = payload.email.trim().toLowerCase();
    const role: Exclude<WorkspaceMemberRole, "OWNER"> = payload.role ?? "MEMBER";

    if (email === requesterEmail) {
      throw new AppError(status.BAD_REQUEST, "You cannot invite yourself");
    }

    await markExpiredPendingInvitations(workspaceId, email);

    const invitedUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    });

    if (invitedUser) {
      const existingMembership = await prisma.workspaceMember.findFirst({
        where: {
          workspaceId,
          userId: invitedUser.id,
        },
      });

      if (existingMembership) {
        throw new AppError(status.CONFLICT, "This user is already a member of the workspace");
      }
    }

    const existingPendingInvitation = await prisma.workspaceInvitation.findFirst({
      where: {
        workspaceId,
        email,
        status: InvitationStatus.PENDING,
      },
    });

    if (existingPendingInvitation) {
      throw new AppError(status.CONFLICT, "A pending invitation already exists for this email");
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS);

    const invitation = await prisma.workspaceInvitation.create({
      data: {
        workspaceId,
        email,
        role,
        invitedById,
        token,
        expiresAt,
      },
      include: {
        invitedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
      invitedBy: invitation.invitedBy,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to create invitation");
  }
};

const cancelInvitation = async (req: Request): Promise<void> => {
  try {
    const workspaceId = req.params.workspaceId as string;
    const invitationId = req.params.invitationId as string;

    const invitation = await prisma.workspaceInvitation.findFirst({
      where: { id: invitationId, workspaceId },
      select: {
        id: true,
        status: true,
        expiresAt: true,
      },
    });

    if (!invitation) {
      throw new AppError(status.NOT_FOUND, "Invitation not found");
    }

    if (invitation.status === InvitationStatus.PENDING && invitation.expiresAt < new Date()) {
      await prisma.workspaceInvitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.EXPIRED },
      });

      throw new AppError(status.BAD_REQUEST, "Invitation has already expired");
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new AppError(status.BAD_REQUEST, "Only pending invitations can be cancelled");
    }

    await prisma.workspaceInvitation.update({
      where: { id: invitationId },
      data: {
        status: InvitationStatus.CANCELED,
        canceledAt: new Date(),
      },
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to cancel invitation");
  }
};

const acceptInvitation = async (req: Request): Promise<IAcceptInvitationResponse> => {
  try {
    const token = req.params.token as string;
    const userId = req.user!.id;
    const userEmail = req.user!.email.toLowerCase();

    const invitation = await prisma.workspaceInvitation.findUnique({
      where: { token },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            deletedAt: true,
          },
        },
      },
    });

    if (!invitation) {
      throw new AppError(status.NOT_FOUND, "Invitation not found or invalid token");
    }

    if (invitation.email.toLowerCase() !== userEmail) {
      throw new AppError(status.FORBIDDEN, "This invitation was not sent to you");
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new AppError(status.BAD_REQUEST, "Invitation is no longer valid");
    }

    if (invitation.expiresAt < new Date()) {
      await prisma.workspaceInvitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.EXPIRED },
      });

      throw new AppError(status.BAD_REQUEST, "Invitation has expired");
    }

    if (invitation.workspace.deletedAt) {
      throw new AppError(status.NOT_FOUND, "Workspace no longer exists");
    }

    const existingMembership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: invitation.workspaceId,
        userId,
      },
    });

    if (existingMembership) {
      throw new AppError(status.CONFLICT, "You are already a member of this workspace");
    }

    await prisma.$transaction(async (tx) => {
      await tx.workspaceMember.create({
        data: {
          workspaceId: invitation.workspaceId,
          userId,
          role: invitation.role,
          status: WorkspaceMemberStatus.ACTIVE,
          addedByUserId: invitation.invitedById,
        },
      });

      await tx.workspaceInvitation.update({
        where: { id: invitation.id },
        data: {
          status: InvitationStatus.ACCEPTED,
          acceptedAt: new Date(),
        },
      });
    });

    return {
      workspaceId: invitation.workspace.id,
      workspaceName: invitation.workspace.name,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to accept invitation");
  }
};

const declineInvitation = async (req: Request): Promise<void> => {
  try {
    const token = req.params.token as string;
    const userEmail = req.user!.email.toLowerCase();

    const invitation = await prisma.workspaceInvitation.findUnique({
      where: { token },
      select: {
        id: true,
        email: true,
        status: true,
        expiresAt: true,
      },
    });

    if (!invitation) {
      throw new AppError(status.NOT_FOUND, "Invitation not found or invalid token");
    }

    if (invitation.email.toLowerCase() !== userEmail) {
      throw new AppError(status.FORBIDDEN, "This invitation was not sent to you");
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new AppError(status.BAD_REQUEST, "Invitation is no longer valid");
    }

    if (invitation.expiresAt < new Date()) {
      await prisma.workspaceInvitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.EXPIRED },
      });

      throw new AppError(status.BAD_REQUEST, "Invitation has expired");
    }

    await prisma.workspaceInvitation.update({
      where: { id: invitation.id },
      data: {
        status: InvitationStatus.REJECTED,
        rejectedAt: new Date(),
      },
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to decline invitation");
  }
};

export const InvitationService = {
  getInvitations,
  createInvitation,
  cancelInvitation,
  acceptInvitation,
  declineInvitation,
};
