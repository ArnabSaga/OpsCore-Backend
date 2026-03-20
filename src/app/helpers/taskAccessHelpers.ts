import { Request } from "express";
import status from "http-status";
import AppError from "../errors/AppError";
import { WorkspaceMemberRole, WorkspaceMemberStatus } from "../constants/role";
import { prisma } from "../lib/prisma";

export const buildMemberTaskAccessWhere = (req: Request) => {
  if (req.workspaceRole !== WorkspaceMemberRole.MEMBER) return {};

  return {
    OR: [{ assignedToUserId: req.user!.id }, { createdByUserId: req.user!.id }],
  };
};

export const getProjectOrThrow = async (projectId: string, workspaceId: string) => {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      workspaceId,
      deletedAt: null,
    },
    select: {
      id: true,
      workspaceId: true,
      name: true,
      status: true,
      archivedAt: true,
      deletedAt: true,
    },
  });

  if (!project) {
    throw new AppError(status.NOT_FOUND, "Project not found");
  }

  return project;
};

export const assertProjectUsableForWrites = async (projectId: string, workspaceId: string) => {
  const project = await getProjectOrThrow(projectId, workspaceId);

  if (project.archivedAt || project.status === "ARCHIVED") {
    throw new AppError(
      status.BAD_REQUEST,
      "Tasks cannot be created or moved under an archived project"
    );
  }

  return project;
};

export const assertAssignableUser = async (userId: string, workspaceId: string) => {
  const membership = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId,
      userId,
      status: WorkspaceMemberStatus.ACTIVE,
      workspace: { deletedAt: null },
    },
    select: {
      id: true,
      userId: true,
    },
  });

  if (!membership) {
    throw new AppError(
      status.BAD_REQUEST,
      "Assigned user must be an active member of the current workspace"
    );
  }
};

export const getScopedTaskOrThrow = async (req: Request, taskId: string, workspaceId: string) => {
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      workspaceId,
      deletedAt: null,
      project: { deletedAt: null },
      ...buildMemberTaskAccessWhere(req),
    },
    select: {
      id: true,
      workspaceId: true,
      projectId: true,
      assignedToUserId: true,
      createdByUserId: true,
      status: true,
      priority: true,
      dueDate: true,
      project: {
        select: {
          id: true,
          name: true,
          status: true,
          archivedAt: true,
          deletedAt: true,
        },
      },
    },
  });

  if (!task) {
    throw new AppError(status.NOT_FOUND, "Task not found");
  }

  return task;
};

export const getScopedTaskCommentOrThrow = async (
  req: Request,
  taskId: string,
  commentId: string,
  workspaceId: string
) => {
  const comment = await prisma.taskComment.findFirst({
    where: {
      id: commentId,
      taskId,
      workspaceId,
      task: {
        deletedAt: null,
        project: { deletedAt: null },
        ...buildMemberTaskAccessWhere(req),
      },
    },
    select: {
      id: true,
      taskId: true,
      workspaceId: true,
      userId: true,
      task: {
        select: {
          id: true,
          project: {
            select: {
              archivedAt: true,
              status: true,
            },
          },
        },
      },
    },
  });

  if (!comment) {
    throw new AppError(status.NOT_FOUND, "Task comment not found");
  }

  return comment;
};

export const getScopedTaskAttachmentOrThrow = async (
  req: Request,
  taskId: string,
  attachmentId: string,
  workspaceId: string
) => {
  const attachment = await prisma.taskAttachment.findFirst({
    where: {
      id: attachmentId,
      taskId,
      workspaceId,
      task: {
        deletedAt: null,
        project: { deletedAt: null },
        ...buildMemberTaskAccessWhere(req),
      },
    },
    select: {
      id: true,
      taskId: true,
      workspaceId: true,
      uploadedById: true,
      fileUrl: true,
      task: {
        select: {
          id: true,
          project: {
            select: {
              archivedAt: true,
              status: true,
            },
          },
        },
      },
    },
  });

  if (!attachment) {
    throw new AppError(status.NOT_FOUND, "Task attachment not found");
  }

  return attachment;
};

export const assertTaskWriteAllowed = async (req: Request, taskId: string, workspaceId: string) => {
  const task = await getScopedTaskOrThrow(req, taskId, workspaceId);

  if (task.project.archivedAt || task.project.status === "ARCHIVED") {
    throw new AppError(
      status.BAD_REQUEST,
      "Archived project tasks cannot be modified with comments or attachments"
    );
  }

  return task;
};
