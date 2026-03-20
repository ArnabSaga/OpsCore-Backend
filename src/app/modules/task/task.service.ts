import { Request } from "express";
import status from "http-status";
import AppError from "../../errors/AppError";
import { destroyCloudinaryAssetByUrl } from "../../lib/cloudinary";
import { WorkspaceMemberRole, WorkspaceMemberStatus } from "../../constants/role";
import { TASK_DEFAULTS, TaskStatus } from "../../constants/task";
import { prisma } from "../../lib/prisma";
import {
  assertPlanFeatureEnabled,
  assertPlanLimitNotReached,
  resolveWorkspacePlanContext,
} from "../../utils/checkPlanLimit";
import {
  ICreateTaskCommentPayload,
  ICreateTaskPayload,
  IPaginatedTaskAttachmentResponse,
  IPaginatedTaskCommentResponse,
  ITaskAttachmentQuery,
  ITaskAttachmentResponse,
  ITaskCommentQuery,
  ITaskCommentResponse,
  ITaskListItem,
  ITaskQuery,
  ITaskResponse,
  IUpdateTaskCommentPayload,
  IUpdateTaskPayload,
} from "./task.interface";

const getProjectOrThrow = async (projectId: string, workspaceId: string) => {
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

const assertProjectUsableForWrites = async (projectId: string, workspaceId: string) => {
  const project = await getProjectOrThrow(projectId, workspaceId);

  if (project.archivedAt || project.status === "ARCHIVED") {
    throw new AppError(
      status.BAD_REQUEST,
      "Tasks cannot be created or moved under an archived project"
    );
  }

  return project;
};

const assertAssignableUser = async (userId: string, workspaceId: string) => {
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

const buildMemberTaskAccessWhere = (userId: string, workspaceRole: string) => {
  if (workspaceRole !== WorkspaceMemberRole.MEMBER) return {};

  return {
    OR: [{ assignedToUserId: userId }, { createdByUserId: userId }],
  };
};

const getScopedTaskOrThrow = async (
  userId: string,
  workspaceRole: string,
  taskId: string,
  workspaceId: string
) => {
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      workspaceId,
      deletedAt: null,
      project: { deletedAt: null },
      ...buildMemberTaskAccessWhere(userId, workspaceRole),
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

const getScopedTaskCommentOrThrow = async (
  userId: string,
  workspaceRole: string,
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
        ...buildMemberTaskAccessWhere(userId, workspaceRole),
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

const getScopedTaskAttachmentOrThrow = async (
  userId: string,
  workspaceRole: string,
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
        ...buildMemberTaskAccessWhere(userId, workspaceRole),
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

const assertTaskWriteAllowed = async (
  userId: string,
  workspaceRole: string,
  taskId: string,
  workspaceId: string
) => {
  const task = await getScopedTaskOrThrow(userId, workspaceRole, taskId, workspaceId);

  if (task.project.archivedAt || task.project.status === "ARCHIVED") {
    throw new AppError(
      status.BAD_REQUEST,
      "Archived project tasks cannot be modified with comments or attachments"
    );
  }

  return task;
};

const getTaskSelect = {
  id: true,
  workspaceId: true,
  projectId: true,
  assignedToUserId: true,
  createdByUserId: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  dueDate: true,
  createdAt: true,
  updatedAt: true,
  project: {
    select: {
      id: true,
      name: true,
      status: true,
      archivedAt: true,
    },
  },
  assignedToUser: {
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
    },
  },
  createdByUser: {
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
    },
  },
  _count: {
    select: {
      comments: true,
      attachments: true,
    },
  },
} as const;

const taskCommentSelect = {
  id: true,
  workspaceId: true,
  taskId: true,
  userId: true,
  body: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
    },
  },
} as const;

const taskAttachmentSelect = {
  id: true,
  workspaceId: true,
  taskId: true,
  uploadedById: true,
  fileName: true,
  fileUrl: true,
  mimeType: true,
  fileSize: true,
  createdAt: true,
  uploadedBy: {
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
    },
  },
} as const;

const assertTaskQueryAccess = async (workspaceId: string, query: ITaskQuery) => {
  const usesAdvancedFilters = Boolean(
    query.searchTerm ||
    query.projectId ||
    query.assignedToUserId ||
    query.status ||
    query.priority ||
    query.overdue ||
    query.dueFrom ||
    query.dueTo ||
    query.sortBy
  );

  if (usesAdvancedFilters) {
    await assertPlanFeatureEnabled(workspaceId, "tasks.advancedFilters");
  }
};

const assertTaskUpdatePermission = (
  userId: string,
  workspaceRole: string,
  payload: IUpdateTaskPayload,
  existingTask: {
    assignedToUserId: string | null;
    createdByUserId: string;
    project: { archivedAt: Date | null; status: string };
  }
) => {

  if (workspaceRole === WorkspaceMemberRole.OWNER || workspaceRole === WorkspaceMemberRole.ADMIN) {
    return;
  }

  if (workspaceRole !== WorkspaceMemberRole.MEMBER) {
    throw new AppError(status.FORBIDDEN, "You do not have permission to update this task");
  }

  const isAssignee = existingTask.assignedToUserId === userId;
  const isCreator = existingTask.createdByUserId === userId;

  if (!isAssignee && !isCreator) {
    throw new AppError(status.FORBIDDEN, "You do not have permission to update this task");
  }

  if (payload.projectId !== undefined || payload.assignedToUserId !== undefined) {
    throw new AppError(
      status.FORBIDDEN,
      "Members can update only task progress fields, not assignment or project linkage"
    );
  }

  const allowedKeys = ["title", "description", "status", "priority", "dueDate"] as const;
  const disallowedKeys = Object.keys(payload).filter(
    (key) => !allowedKeys.includes(key as (typeof allowedKeys)[number])
  );

  if (disallowedKeys.length > 0) {
    throw new AppError(
      status.FORBIDDEN,
      "Members can update only task progress fields, not assignment or project linkage"
    );
  }
};

const getTasks = async (
  workspaceId: string,
  workspaceRole: string,
  userId: string,
  query: ITaskQuery
): Promise<{
  data: ITaskListItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}> => {
  try {

    await assertTaskQueryAccess(workspaceId, query);

    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 100);
    const skip = (page - 1) * limit;
    const sortBy = query.sortBy ?? "createdAt";
    const sortOrder = query.sortOrder === "asc" ? "asc" : "desc";

    const where: any = {
      workspaceId,
      deletedAt: null,
      project: { deletedAt: null },
    };

    const andConditions: any[] = [];

    if (workspaceRole === WorkspaceMemberRole.MEMBER) {
      andConditions.push({
        OR: [{ assignedToUserId: userId }, { createdByUserId: userId }],
      });
    }

    if (query.searchTerm) {
      andConditions.push({
        OR: [
          { title: { contains: query.searchTerm, mode: "insensitive" } },
          { description: { contains: query.searchTerm, mode: "insensitive" } },
        ],
      });
    }

    if (query.projectId) {
      await getProjectOrThrow(query.projectId, workspaceId);
      andConditions.push({ projectId: query.projectId });
    }

    if (query.assignedToUserId) {
      andConditions.push({ assignedToUserId: query.assignedToUserId });
    }

    if (query.assignedToMe === "true") {
      andConditions.push({ assignedToUserId: userId });
    }

    if (query.status) {
      andConditions.push({ status: query.status });
    }

    if (query.priority) {
      andConditions.push({ priority: query.priority });
    }

    if (query.overdue === "true") {
      andConditions.push({ dueDate: { lt: new Date() } });

      if (!query.status) {
        andConditions.push({ status: { not: TaskStatus.DONE } });
      }
    }

    if (query.dueFrom || query.dueTo) {
      andConditions.push({
        dueDate: {
          ...(query.dueFrom ? { gte: new Date(query.dueFrom) } : {}),
          ...(query.dueTo ? { lte: new Date(query.dueTo) } : {}),
        },
      });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        select: getTaskSelect,
      }),
      prisma.task.count({ where }),
    ]);

    return {
      data: tasks,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to fetch tasks");
  }
};

const createTask = async (req: Request): Promise<ITaskResponse> => {
  try {
    const workspaceId = req.workspaceId!;
    const createdByUserId = req.user!.id;
    const payload = req.body as ICreateTaskPayload;

    await assertPlanFeatureEnabled(workspaceId, "tasks.create");
    await assertPlanLimitNotReached({
      workspaceId,
      limitKey: "tasks",
      incrementBy: 1,
      customMessage: 'You have reached the "tasks" limit for your current plan.',
    });

    await assertProjectUsableForWrites(payload.projectId, workspaceId);

    if (payload.assignedToUserId) {
      await assertAssignableUser(payload.assignedToUserId, workspaceId);
    }

    const task = await prisma.task.create({
      data: {
        workspaceId,
        projectId: payload.projectId,
        createdByUserId,
        assignedToUserId: payload.assignedToUserId ?? null,
        title: payload.title.trim(),
        description: payload.description?.trim(),
        status: payload.status ?? TASK_DEFAULTS.status,
        priority: payload.priority ?? TASK_DEFAULTS.priority,
        dueDate: payload.dueDate ? new Date(payload.dueDate) : undefined,
      },
      select: getTaskSelect,
    });

    const planContext = await resolveWorkspacePlanContext(workspaceId);

    return {
      ...task,
      planMeta: {
        workspacePlan: planContext.effectivePlan,
        isTrialActive: planContext.isTrialActive,
        trialStartsAt: planContext.trialStartedAt,
        trialEndsAt: planContext.trialEndsAt,
      },
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to create task");
  }
};

const getTask = async (req: Request): Promise<ITaskResponse> => {
  try {
    const workspaceId = req.workspaceId!;
    const taskId = req.params.taskId as string;

    await getScopedTaskOrThrow(req.user!.id, req.workspaceRole!, taskId, workspaceId);

    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        workspaceId,
        deletedAt: null,
        project: { deletedAt: null },
        ...buildMemberTaskAccessWhere(req.user!.id, req.workspaceRole!),
      },
      select: getTaskSelect,
    });

    if (!task) {
      throw new AppError(status.NOT_FOUND, "Task not found");
    }

    const planContext = await resolveWorkspacePlanContext(workspaceId);

    return {
      ...task,
      planMeta: {
        workspacePlan: planContext.effectivePlan,
        isTrialActive: planContext.isTrialActive,
        trialStartsAt: planContext.trialStartedAt,
        trialEndsAt: planContext.trialEndsAt,
      },
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to fetch task");
  }
};

const updateTask = async (req: Request): Promise<ITaskResponse> => {
  try {
    const workspaceId = req.workspaceId!;
    const taskId = req.params.taskId as string;
    const payload = req.body as IUpdateTaskPayload;

    const existingTask = await getScopedTaskOrThrow(req.user!.id, req.workspaceRole!, taskId, workspaceId);

    assertTaskUpdatePermission(req.user!.id, req.workspaceRole!, payload, existingTask);

    if (existingTask.project.archivedAt || existingTask.project.status === "ARCHIVED") {
      throw new AppError(status.BAD_REQUEST, "Tasks under an archived project cannot be updated");
    }

    if (payload.projectId) {
      await assertProjectUsableForWrites(payload.projectId, workspaceId);
    }

    if (payload.assignedToUserId !== undefined && payload.assignedToUserId !== null) {
      await assertAssignableUser(payload.assignedToUserId, workspaceId);
    }

    const task = await prisma.task.update({
      where: { id: taskId },
      data: {
        ...(payload.projectId !== undefined && { projectId: payload.projectId }),
        ...(payload.title !== undefined && { title: payload.title.trim() }),
        ...(payload.description !== undefined && {
          description: payload.description === null ? null : payload.description.trim(),
        }),
        ...(payload.assignedToUserId !== undefined && {
          assignedToUserId: payload.assignedToUserId,
        }),
        ...(payload.status !== undefined && { status: payload.status }),
        ...(payload.priority !== undefined && { priority: payload.priority }),
        ...(payload.dueDate !== undefined && {
          dueDate: payload.dueDate ? new Date(payload.dueDate) : null,
        }),
      },
      select: getTaskSelect,
    });

    const planContext = await resolveWorkspacePlanContext(workspaceId);

    return {
      ...task,
      planMeta: {
        workspacePlan: planContext.effectivePlan,
        isTrialActive: planContext.isTrialActive,
        trialStartsAt: planContext.trialStartedAt,
        trialEndsAt: planContext.trialEndsAt,
      },
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to update task");
  }
};

const deleteTask = async (req: Request): Promise<void> => {
  try {
    const workspaceId = req.workspaceId!;
    const taskId = req.params.taskId as string;

    await getScopedTaskOrThrow(req.user!.id, req.workspaceRole!, taskId, workspaceId);

    if (req.workspaceRole === WorkspaceMemberRole.MEMBER) {
      throw new AppError(status.FORBIDDEN, "Members do not have permission to delete tasks");
    }

    const attachments = await prisma.taskAttachment.findMany({
      where: {
        taskId,
        workspaceId,
      },
      select: {
        id: true,
        fileUrl: true,
      },
    });

    await prisma.$transaction(async (tx) => {
      await tx.taskComment.deleteMany({
        where: {
          taskId,
          workspaceId,
        },
      });

      await tx.taskAttachment.deleteMany({
        where: {
          taskId,
          workspaceId,
        },
      });

      await tx.task.update({
        where: { id: taskId },
        data: { deletedAt: new Date() },
      });
    });

    await Promise.allSettled(
      attachments.map((attachment) => destroyCloudinaryAssetByUrl(attachment.fileUrl))
    );
  } catch (error) {
    if (error instanceof AppError) throw error;

    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to delete task");
  }
};

const getTaskComments = async (
  workspaceId: string,
  workspaceRole: string,
  userId: string,
  taskId: string,
  query: ITaskCommentQuery
): Promise<IPaginatedTaskCommentResponse> => {
  try {
    await getScopedTaskOrThrow(userId, workspaceRole, taskId, workspaceId);

    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;

    const where = {
      taskId,
      workspaceId,
      task: {
        deletedAt: null,
        project: { deletedAt: null },
        ...buildMemberTaskAccessWhere(userId, workspaceRole),
      },
    };

    const [comments, total] = await Promise.all([
      prisma.taskComment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "asc" },
        select: taskCommentSelect,
      }),
      prisma.taskComment.count({ where }),
    ]);

    return {
      data: comments,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to fetch task comments");
  }
};

const createTaskComment = async (req: Request): Promise<ITaskCommentResponse> => {
  try {
    const workspaceId = req.workspaceId!;
    const taskId = req.params.taskId as string;
    const userId = req.user!.id;
    const payload = req.body as ICreateTaskCommentPayload;

    await assertPlanFeatureEnabled(workspaceId, "tasks.comments");
    await assertTaskWriteAllowed(req.user!.id, req.workspaceRole!, taskId, workspaceId);
    await assertPlanLimitNotReached({
      workspaceId,
      limitKey: "taskCommentsPerTask",
      resourceId: taskId,
      incrementBy: 1,
      customMessage:
        'You have reached the "taskCommentsPerTask" limit for this task on your current plan.',
    });

    const comment = await prisma.taskComment.create({
      data: {
        workspaceId,
        taskId,
        userId,
        body: payload.body.trim(),
      },
      select: taskCommentSelect,
    });

    return comment;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to create task comment");
  }
};

const updateTaskComment = async (req: Request): Promise<ITaskCommentResponse> => {
  try {
    const workspaceId = req.workspaceId!;
    const taskId = req.params.taskId as string;
    const commentId = req.params.commentId as string;
    const userId = req.user!.id;
    const payload = req.body as IUpdateTaskCommentPayload;

    const existingComment = await getScopedTaskCommentOrThrow(req.user!.id, req.workspaceRole!, taskId, commentId, workspaceId);

    if (req.workspaceRole === WorkspaceMemberRole.MEMBER && existingComment.userId !== userId) {
      throw new AppError(status.FORBIDDEN, "Members can update only their own task comments");
    }

    if (
      existingComment.task.project.archivedAt ||
      existingComment.task.project.status === "ARCHIVED"
    ) {
      throw new AppError(
        status.BAD_REQUEST,
        "Comments on archived project tasks cannot be updated"
      );
    }

    const comment = await prisma.taskComment.update({
      where: { id: commentId },
      data: {
        body: payload.body.trim(),
      },
      select: taskCommentSelect,
    });

    return comment;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to update task comment");
  }
};

const deleteTaskComment = async (req: Request): Promise<void> => {
  try {
    const workspaceId = req.workspaceId!;
    const taskId = req.params.taskId as string;
    const commentId = req.params.commentId as string;
    const userId = req.user!.id;

    const existingComment = await getScopedTaskCommentOrThrow(req.user!.id, req.workspaceRole!, taskId, commentId, workspaceId);

    if (req.workspaceRole === WorkspaceMemberRole.MEMBER && existingComment.userId !== userId) {
      throw new AppError(status.FORBIDDEN, "Members can delete only their own task comments");
    }

    await prisma.taskComment.delete({
      where: { id: commentId },
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to delete task comment");
  }
};

const getTaskAttachments = async (
  workspaceId: string,
  workspaceRole: string,
  userId: string,
  taskId: string,
  query: ITaskAttachmentQuery
): Promise<IPaginatedTaskAttachmentResponse> => {
  try {
    await getScopedTaskOrThrow(userId, workspaceRole, taskId, workspaceId);

    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;

    const where = {
      taskId,
      workspaceId,
      task: {
        deletedAt: null,
        project: { deletedAt: null },
        ...buildMemberTaskAccessWhere(userId, workspaceRole),
      },
    };

    const [attachments, total] = await Promise.all([
      prisma.taskAttachment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: taskAttachmentSelect,
      }),
      prisma.taskAttachment.count({ where }),
    ]);

    return {
      data: attachments,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to fetch task attachments");
  }
};

const createTaskAttachment = async (req: Request): Promise<ITaskAttachmentResponse> => {
  try {
    const workspaceId = req.workspaceId!;
    const taskId = req.params.taskId as string;
    const uploadedById = req.user!.id;
    const file = req.file;

    await assertPlanFeatureEnabled(workspaceId, "tasks.attachments");
    await assertTaskWriteAllowed(req.user!.id, req.workspaceRole!, taskId, workspaceId);

    if (!file) {
      throw new AppError(status.BAD_REQUEST, "Attachment file is required");
    }

    await assertPlanLimitNotReached({
      workspaceId,
      limitKey: "taskAttachmentsPerTask",
      resourceId: taskId,
      incrementBy: 1,
      customMessage:
        'You have reached the "taskAttachmentsPerTask" limit for this task on your current plan.',
    });

    const fileSizeMb = Math.max(Math.ceil(file.size / (1024 * 1024)), 1);

    await assertPlanLimitNotReached({
      workspaceId,
      limitKey: "storageMb",
      incrementBy: fileSizeMb,
      customMessage: "You do not have enough storage remaining on your current plan.",
    });

    const fileUrl = file.path;

    const attachment = await prisma.taskAttachment.create({
      data: {
        workspaceId,
        taskId,
        uploadedById,
        fileName: file.originalname,
        fileUrl: fileUrl,
        mimeType: file.mimetype,
        fileSize: file.size,
      },
      select: taskAttachmentSelect,
    });

    return attachment;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to upload task attachment");
  }
};

const deleteTaskAttachment = async (req: Request): Promise<void> => {
  try {
    const workspaceId = req.workspaceId!;
    const taskId = req.params.taskId as string;
    const attachmentId = req.params.attachmentId as string;
    const userId = req.user!.id;

    const existingAttachment = await getScopedTaskAttachmentOrThrow(
      req.user!.id,
      req.workspaceRole!,
      taskId,
      attachmentId,
      workspaceId
    );

    if (req.workspaceRole === WorkspaceMemberRole.MEMBER && existingAttachment.uploadedById !== userId) {
      throw new AppError(status.FORBIDDEN, "Members can delete only their own task attachments");
    }

    await prisma.taskAttachment.delete({
      where: { id: attachmentId },
    });

    await destroyCloudinaryAssetByUrl(existingAttachment.fileUrl).catch(() => undefined);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to delete task attachment");
  }
};

export const TaskService = {
  getTasks,
  createTask,
  getTask,
  updateTask,
  deleteTask,
  getTaskComments,
  createTaskComment,
  updateTaskComment,
  deleteTaskComment,
  getTaskAttachments,
  createTaskAttachment,
  deleteTaskAttachment,
};
