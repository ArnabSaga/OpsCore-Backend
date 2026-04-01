import crypto from "crypto";
import { Request } from "express";
import status from "http-status";
import { InvitationStatus } from "../../../generated/prisma/enums";
import {
  WorkspaceMemberRole,
  WorkspaceMemberStatus,
} from "../../constants/role";
import AppError from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import {
  assertPlanFeatureEnabled,
  assertPlanLimitNotReached,
  getCurrentPlanUsage,
  resolveWorkspacePlanContext,
} from "../../utils/checkPlanLimit";
import {
  IAcceptInvitationResponse,
  ICreateInvitationPayload,
  IInvitationResponse,
} from "./invitation.interface";
import { NotificationService } from "../notification/notification.service";
import { auditLog } from "../../utils/auditLog";
import { AuditLogAction, AuditLogEntityType } from "../../constants/auditLog";

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

const assertInvitationRoleAllowed = async (
  workspaceId: string,
  role: Exclude<WorkspaceMemberRole, "OWNER">
) => {
  if (role === WorkspaceMemberRole.ADMIN) {
    await assertPlanFeatureEnabled(workspaceId, "workspace.advancedPermissions");
  }
};

const assertWorkspaceCanInviteMoreMembers = async (workspaceId: string) => {
  const activeMembersCount = await getCurrentPlanUsage({
    workspaceId,
    limitKey: "members",
  });

  const pendingInvitationsCount = await prisma.workspaceInvitation.count({
    where: {
      workspaceId,
      status: InvitationStatus.PENDING,
      expiresAt: { gte: new Date() },
    },
  });

  await assertPlanLimitNotReached({
    workspaceId,
    limitKey: "members",
    incrementBy: 1,
    customUsage: activeMembersCount + pendingInvitationsCount,
    customMessage:
      'You have reached the "members" limit for your current plan. Remove members or upgrade your plan to invite more people.',
  });
};

const getInvitations = async (req: Request): Promise<IInvitationResponse[]> => {
  try {
    const workspaceId = req.params.workspaceId as string;

    await assertPlanFeatureEnabled(workspaceId, "workspace.memberManagement");
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

    const planContext = await resolveWorkspacePlanContext(workspaceId);

    return invitations.map((invitation) => ({
      id: invitation.id,
      email: invitation.email,
      token: invitation.token,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
      acceptedAt: invitation.acceptedAt,
      rejectedAt: invitation.rejectedAt,
      canceledAt: invitation.canceledAt,
      invitedBy: invitation.invitedBy,
      planMeta: {
        workspacePlan: planContext.effectivePlan,
        isTrialActive: planContext.isTrialActive,
        trialStartsAt: planContext.trialStartedAt,
        trialEndsAt: planContext.trialEndsAt,
      },
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
    const inviterName = req.user!.name;
    const requesterEmail = req.user!.email.toLowerCase();
    const payload = req.body as ICreateInvitationPayload;

    const email = payload.email.trim().toLowerCase();
    const role: Exclude<WorkspaceMemberRole, "OWNER"> = payload.role ?? "MEMBER";

    await assertPlanFeatureEnabled(workspaceId, "workspace.memberManagement");
    await assertInvitationRoleAllowed(workspaceId, role);
    await assertPlanLimitNotReached({
      workspaceId,
      limitKey: "monthlyInvitations",
      incrementBy: 1,
      customMessage: 'You have reached the "monthlyInvitations" limit for your current plan.',
    });
    await assertWorkspaceCanInviteMoreMembers(workspaceId);

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
        expiresAt: { gte: new Date() },
      },
    });

    if (existingPendingInvitation) {
      throw new AppError(status.CONFLICT, "A pending invitation already exists for this email");
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS);

    const invitation = await prisma.$transaction(async (tx) => {
      const createdInvitation = await tx.workspaceInvitation.create({
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
          workspace: {
            select: { name: true },
          },
        },
      });

      // Notify existing user if found
      if (invitedUser) {
        await NotificationService.createInvitationReceivedNotification(tx, {
          workspaceId,
          userId: invitedUser.id,
          actorUserId: invitedById,
          workspaceName: createdInvitation.workspace.name,
          inviterName: inviterName,
        });
      }

      await auditLog({
        tx,
        workspaceId,
        actorUserId: invitedById,
        action: AuditLogAction.INVITATION_SENT,
        entityType: AuditLogEntityType.INVITATION,
        entityId: createdInvitation.id,
        entityTitle: createdInvitation.email,
        metadata: {
          role: createdInvitation.role,
        },
      });

      return createdInvitation;
    });

    const planContext = await resolveWorkspacePlanContext(workspaceId);

    return {
      id: invitation.id,
      email: invitation.email,
      token: invitation.token,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
      acceptedAt: invitation.acceptedAt,
      rejectedAt: invitation.rejectedAt,
      canceledAt: invitation.canceledAt,
      invitedBy: invitation.invitedBy,
      planMeta: {
        workspacePlan: planContext.effectivePlan,
        isTrialActive: planContext.isTrialActive,
        trialStartsAt: planContext.trialStartedAt,
        trialEndsAt: planContext.trialEndsAt,
      },
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

    await assertPlanFeatureEnabled(workspaceId, "workspace.memberManagement");

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

    await prisma.$transaction(async (tx) => {
      const updated = await tx.workspaceInvitation.update({
        where: { id: invitationId },
        data: {
          status: InvitationStatus.CANCELED,
          canceledAt: new Date(),
        },
        select: {
          id: true,
          email: true,
        },
      });

      await auditLog({
        tx,
        workspaceId,
        actorUserId: req.user!.id,
        action: AuditLogAction.INVITATION_REVOKED,
        entityType: AuditLogEntityType.INVITATION,
        entityId: updated.id,
        entityTitle: updated.email,
      });
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

    await assertPlanFeatureEnabled(invitation.workspaceId, "workspace.memberManagement");
    await assertInvitationRoleAllowed(
      invitation.workspaceId,
      invitation.role as Exclude<WorkspaceMemberRole, "OWNER">
    );
    await assertWorkspaceCanInviteMoreMembers(invitation.workspaceId);

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

      // Notify the inviter
      await NotificationService.createInvitationAcceptedNotification(tx, {
        workspaceId: invitation.workspaceId,
        userId: invitation.invitedById,
        actorUserId: userId,
        workspaceName: invitation.workspace.name,
        accepterName: req.user!.name,
      });

      await auditLog({
        tx,
        workspaceId: invitation.workspaceId,
        actorUserId: userId,
        action: AuditLogAction.INVITATION_ACCEPTED,
        entityType: AuditLogEntityType.INVITATION,
        entityId: invitation.id,
        entityTitle: invitation.email,
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

    await prisma.$transaction(async (tx) => {
      const updated = await tx.workspaceInvitation.update({
        where: { id: invitation.id },
        data: {
          status: InvitationStatus.REJECTED,
          rejectedAt: new Date(),
        },
        select: {
          id: true,
          email: true,
          workspaceId: true,
        },
      });

      await auditLog({
        tx,
        workspaceId: updated.workspaceId,
        actorUserId: req.user!.id,
        action: AuditLogAction.INVITATION_DECLINED,
        entityType: AuditLogEntityType.INVITATION,
        entityId: updated.id,
        entityTitle: updated.email,
      });
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to decline invitation");
  }
};



const getMyInvitations = async (req: Request): Promise<IInvitationResponse[]> => {
  try {
    const userEmail = req.user!.email.toLowerCase();

    // Auto-expire any stale pending invitations for this email
    await prisma.workspaceInvitation.updateMany({
      where: {
        email: userEmail,
        status: InvitationStatus.PENDING,
        expiresAt: { lt: new Date() },
      },
      data: { status: InvitationStatus.EXPIRED },
    });

    const invitations = await prisma.workspaceInvitation.findMany({
      where: {
        email: userEmail,
        status: InvitationStatus.PENDING,
        expiresAt: { gte: new Date() },
      },
      include: {
        invitedBy: {
          select: { id: true, name: true, email: true },
        },
        workspace: {
          select: { id: true, name: true, slug: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return invitations.map((invitation) => ({
      id: invitation.id,
      email: invitation.email,
      token: invitation.token,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
      acceptedAt: invitation.acceptedAt,
      rejectedAt: invitation.rejectedAt,
      canceledAt: invitation.canceledAt,
      invitedBy: invitation.invitedBy,
      workspace: invitation.workspace ?? undefined,
    }));
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to fetch your invitations");
  }
};

const resendInvitation = async (req: Request): Promise<IInvitationResponse> => {
  try {
    const workspaceId = req.params.workspaceId as string;
    const invitationId = req.params.invitationId as string;
    const invitedById = req.user!.id;

    await assertPlanFeatureEnabled(workspaceId, "workspace.memberManagement");

    const existingInvitation = await prisma.workspaceInvitation.findFirst({
      where: { id: invitationId, workspaceId },
    });

    if (!existingInvitation) {
      throw new AppError(status.NOT_FOUND, "Invitation not found");
    }

    if (existingInvitation.status === InvitationStatus.ACCEPTED) {
      throw new AppError(status.BAD_REQUEST, "Cannot resend an accepted invitation");
    }

    // Cancel old invitation if it was still pending
    if (existingInvitation.status === InvitationStatus.PENDING) {
      await prisma.workspaceInvitation.update({
        where: { id: existingInvitation.id },
        data: { status: InvitationStatus.CANCELED, canceledAt: new Date() },
      });
    }

    await assertPlanLimitNotReached({
      workspaceId,
      limitKey: "monthlyInvitations",
      incrementBy: 1,
      customMessage: 'You have reached the "monthlyInvitations" limit for your current plan.',
    });
    await assertWorkspaceCanInviteMoreMembers(workspaceId);

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS);

    const newInvitation = await prisma.workspaceInvitation.create({
      data: {
        workspaceId,
        email: existingInvitation.email,
        role: existingInvitation.role,
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

    const planContext = await resolveWorkspacePlanContext(workspaceId);

    return {
      id: newInvitation.id,
      email: newInvitation.email,
      token: newInvitation.token,
      role: newInvitation.role,
      status: newInvitation.status,
      expiresAt: newInvitation.expiresAt,
      createdAt: newInvitation.createdAt,
      acceptedAt: newInvitation.acceptedAt,
      rejectedAt: newInvitation.rejectedAt,
      canceledAt: newInvitation.canceledAt,
      invitedBy: newInvitation.invitedBy,
      planMeta: {
        workspacePlan: planContext.effectivePlan,
        isTrialActive: planContext.isTrialActive,
        trialStartsAt: planContext.trialStartedAt,
        trialEndsAt: planContext.trialEndsAt,
      },
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to resend invitation");
  }
};

const expireInvitation = async (req: Request): Promise<void> => {
  try {
    const workspaceId = req.params.workspaceId as string;
    const invitationId = req.params.invitationId as string;

    await assertPlanFeatureEnabled(workspaceId, "workspace.memberManagement");

    const invitation = await prisma.workspaceInvitation.findFirst({
      where: { id: invitationId, workspaceId },
      select: { id: true, status: true },
    });

    if (!invitation) {
      throw new AppError(status.NOT_FOUND, "Invitation not found");
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new AppError(status.BAD_REQUEST, "Only pending invitations can be expired");
    }

    await prisma.workspaceInvitation.update({
      where: { id: invitation.id },
      data: { status: InvitationStatus.EXPIRED },
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to manually expire invitation");
  }
};

const getInvitationByToken = async (req: Request): Promise<IInvitationResponse> => {
  try {
    const token = req.params.token as string;

    const invitation = await prisma.workspaceInvitation.findUnique({
      where: { token },
      include: {
        invitedBy: {
          select: { id: true, name: true, email: true },
        },
        workspace: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    if (!invitation) {
      throw new AppError(status.NOT_FOUND, "Invitation not found or invalid token");
    }

    // Auto-expire if needed
    if (invitation.status === InvitationStatus.PENDING && invitation.expiresAt < new Date()) {
      await prisma.workspaceInvitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.EXPIRED },
      });
      invitation.status = InvitationStatus.EXPIRED;
    }

    const planContext = await resolveWorkspacePlanContext(invitation.workspaceId);

    return {
      id: invitation.id,
      email: invitation.email,
      token: invitation.token,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
      acceptedAt: invitation.acceptedAt,
      rejectedAt: invitation.rejectedAt,
      canceledAt: invitation.canceledAt,
      invitedBy: invitation.invitedBy,
      workspace: invitation.workspace,
      planMeta: {
        workspacePlan: planContext.effectivePlan,
        isTrialActive: planContext.isTrialActive,
        trialStartsAt: planContext.trialStartedAt,
        trialEndsAt: planContext.trialEndsAt,
      },
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to fetch invitation details");
  }
};

const deleteInvitation = async (req: Request): Promise<void> => {
  try {
    const invitationId = req.params.invitationId as string;

    const invitation = await prisma.workspaceInvitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation) {
      throw new AppError(status.NOT_FOUND, "Invitation not found");
    }

    await prisma.workspaceInvitation.delete({
      where: { id: invitationId },
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to delete invitation");
  }
};

export const InvitationService = {
  getInvitations,
  getMyInvitations,
  createInvitation,
  cancelInvitation,
  acceptInvitation,
  declineInvitation,
  resendInvitation,
  expireInvitation,
  getInvitationByToken,
  deleteInvitation,
};
