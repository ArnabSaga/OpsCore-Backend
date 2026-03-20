import { Request } from "express";
import status from "http-status";
import { WorkspaceMemberRole, WorkspaceMemberStatus } from "../../constants/role";
import AppError from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import { assertPlanFeatureEnabled } from "../../utils/checkPlanLimit";
import {
  IUpdateWorkspaceMemberPayload,
  IWorkspaceMemberResponse,
} from "./workspaceMember.interface";


const getScopedMemberOrThrow = async (workspaceId: string, memberId: string) => {
  const member = await prisma.workspaceMember.findFirst({
    where: {
      id: memberId,
      workspaceId,
      workspace: {
        deletedAt: null,
      },
    },
    select: {
      id: true,
      workspaceId: true,
      userId: true,
      role: true,
      status: true,
      joinedAt: true,
      addedByUserId: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    },
  });

  if (!member) {
    throw new AppError(status.NOT_FOUND, "Member not found in this workspace");
  }

  return member;
};

const countActiveOwners = async (workspaceId: string): Promise<number> => {
  return prisma.workspaceMember.count({
    where: {
      workspaceId,
      role: WorkspaceMemberRole.OWNER,
      status: WorkspaceMemberStatus.ACTIVE,
      workspace: {
        deletedAt: null,
      },
    },
  });
};

const assertRequesterCanManageTarget = async (
  req: Request,
  targetMember: Awaited<ReturnType<typeof getScopedMemberOrThrow>>,
  payload?: IUpdateWorkspaceMemberPayload
) => {
  const requesterRole = req.workspaceRole;
  const requesterUserId = req.user!.id;

  if (!requesterRole) {
    throw new AppError(status.FORBIDDEN, "Workspace role is missing from request context");
  }

  if (requesterRole === WorkspaceMemberRole.OWNER) {
    return;
  }

  if (requesterRole !== WorkspaceMemberRole.ADMIN) {
    throw new AppError(status.FORBIDDEN, "You do not have permission to manage workspace members");
  }

  if (targetMember.role === WorkspaceMemberRole.OWNER) {
    throw new AppError(status.FORBIDDEN, "Admins cannot manage owners");
  }

  if (payload?.role === WorkspaceMemberRole.OWNER) {
    if (targetMember.userId === requesterUserId) {
      throw new AppError(status.FORBIDDEN, "Admins cannot elevate themselves to owner");
    }
    throw new AppError(status.FORBIDDEN, "Admins cannot promote members to owner");
  }
};

const mapWorkspaceMemberResponse = (
  member: Awaited<ReturnType<typeof getScopedMemberOrThrow>>
): IWorkspaceMemberResponse => {
  return {
    id: member.id,
    workspaceId: member.workspaceId,
    userId: member.userId,
    role: member.role,
    status: member.status,
    joinedAt: member.joinedAt,
    addedByUserId: member.addedByUserId,
    user: {
      id: member.user.id,
      name: member.user.name,
      email: member.user.email,
      image: member.user.image,
    },
  };
};

const getMembers = async (req: Request): Promise<IWorkspaceMemberResponse[]> => {
  try {
    const workspaceId = req.params.workspaceId as string;

    await assertPlanFeatureEnabled(workspaceId, "workspace.memberManagement");

    const members = await prisma.workspaceMember.findMany({
      where: {
        workspaceId,
        workspace: {
          deletedAt: null,
        },
      },
      select: {
        id: true,
        workspaceId: true,
        userId: true,
        role: true,
        status: true,
        joinedAt: true,
        addedByUserId: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
    });

    return members.map((member) => ({
      id: member.id,
      workspaceId: member.workspaceId,
      userId: member.userId,
      role: member.role,
      status: member.status,
      joinedAt: member.joinedAt,
      addedByUserId: member.addedByUserId,
      user: {
        id: member.user.id,
        name: member.user.name,
        email: member.user.email,
        image: member.user.image,
      },
    }));
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to fetch members");
  }
};

const updateMember = async (req: Request): Promise<IWorkspaceMemberResponse> => {
  try {
    const workspaceId = req.params.workspaceId as string;
    const memberId = req.params.memberId as string;
    const payload = req.body as IUpdateWorkspaceMemberPayload;

    await assertPlanFeatureEnabled(workspaceId, "workspace.advancedPermissions");

    const existingMember = await getScopedMemberOrThrow(workspaceId, memberId);

    await assertRequesterCanManageTarget(req, existingMember, payload);

    const requestingUserId = req.user!.id;

    if (
      existingMember.userId === requestingUserId &&
      payload.status === WorkspaceMemberStatus.INACTIVE
    ) {
      throw new AppError(status.BAD_REQUEST, "You cannot deactivate yourself");
    }

    const isOwnerBeingDemoted =
      existingMember.role === WorkspaceMemberRole.OWNER &&
      payload.role !== undefined &&
      payload.role !== WorkspaceMemberRole.OWNER;

    const isOwnerBeingDeactivated =
      existingMember.role === WorkspaceMemberRole.OWNER &&
      payload.status === WorkspaceMemberStatus.INACTIVE &&
      existingMember.status === WorkspaceMemberStatus.ACTIVE;

    if (isOwnerBeingDemoted || isOwnerBeingDeactivated) {
      const activeOwnerCount = await countActiveOwners(workspaceId);

      if (activeOwnerCount <= 1) {
        throw new AppError(status.BAD_REQUEST, "Cannot demote or deactivate the only active owner");
      }
    }

    const updatedMember = await prisma.workspaceMember.update({
      where: { id: memberId },
      data: {
        ...(payload.role !== undefined ? { role: payload.role } : {}),
        ...(payload.status !== undefined ? { status: payload.status } : {}),
      },
      select: {
        id: true,
        workspaceId: true,
        userId: true,
        role: true,
        status: true,
        joinedAt: true,
        addedByUserId: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    return {
      id: updatedMember.id,
      workspaceId: updatedMember.workspaceId,
      userId: updatedMember.userId,
      role: updatedMember.role,
      status: updatedMember.status,
      joinedAt: updatedMember.joinedAt,
      addedByUserId: updatedMember.addedByUserId,
      user: {
        id: updatedMember.user.id,
        name: updatedMember.user.name,
        email: updatedMember.user.email,
        image: updatedMember.user.image,
      },
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to update member");
  }
};

const removeMember = async (req: Request): Promise<void> => {
  try {
    const workspaceId = req.params.workspaceId as string;
    const memberId = req.params.memberId as string;
    const requestingUserId = req.user!.id;

    await assertPlanFeatureEnabled(workspaceId, "workspace.advancedPermissions");

    const existingMember = await getScopedMemberOrThrow(workspaceId, memberId);

    await assertRequesterCanManageTarget(req, existingMember);

    if (existingMember.userId === requestingUserId) {
      throw new AppError(status.BAD_REQUEST, "Cannot remove yourself from a workspace");
    }

    if (existingMember.role === WorkspaceMemberRole.OWNER) {
      const activeOwnerCount = await countActiveOwners(workspaceId);

      if (activeOwnerCount <= 1) {
        throw new AppError(status.BAD_REQUEST, "Cannot remove the only active owner");
      }
    }

    await prisma.workspaceMember.delete({
      where: { id: memberId },
    });
  } catch (error) {
    if (error instanceof AppError) throw error;

    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to remove member");
  }
};

export const WorkspaceMemberService = {
  getMembers,
  updateMember,
  removeMember,
};
