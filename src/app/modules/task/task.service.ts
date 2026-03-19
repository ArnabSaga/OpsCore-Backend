import { Request } from "express";
import status from "http-status";
import AppError from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import {
  assertPlanFeatureEnabled,
  assertPlanLimitNotReached,
  resolveWorkspacePlanContext,
} from "../../utils/checkPlanLimit";
import {
  ICreateTaskPayload,
  ITaskListItem,
  ITaskQuery,
  ITaskResponse,
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
      status: "ACTIVE",
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

const getScopedTaskOrThrow = async (req: Request, taskId: string, workspaceId: string) => {
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      workspaceId,
      deletedAt: null,
      project: { deletedAt: null },
      ...(req.workspaceRole === "MEMBER"
        ? {
            OR: [
              { assignedToUserId: req.user!.id },
              { createdByUserId: req.user!.id },
            ],
          }
        : {}),
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

const hasAdvancedTaskFilters = (query: ITaskQuery) => {
  return Boolean(
    query.searchTerm ||
    query.assignedToUserId ||
    query.overdue === "true" ||
    query.dueFrom ||
    query.dueTo ||
    query.sortBy === "priority" ||
    query.sortBy === "dueDate"
  );
};

const assertTaskQueryAccess = async (workspaceId: string, query: ITaskQuery) => {
  if (hasAdvancedTaskFilters(query)) {
    await assertPlanFeatureEnabled(workspaceId, "tasks.advancedFilters");
  }
};

const assertTaskUpdatePermission = (
  req: Request,
  payload: IUpdateTaskPayload,
  existingTask: Awaited<ReturnType<typeof getScopedTaskOrThrow>>
) => {
  const workspaceRole = req.workspaceRole;
  const currentUserId = req.user!.id;

  if (!workspaceRole) {
    throw new AppError(status.FORBIDDEN, "Workspace role is missing from request context");
  }

  if (workspaceRole === "OWNER" || workspaceRole === "ADMIN") {
    return;
  }

  if (workspaceRole !== "MEMBER") {
    throw new AppError(status.FORBIDDEN, "You do not have permission to update this task");
  }

  if (existingTask.assignedToUserId !== currentUserId) {
    throw new AppError(status.FORBIDDEN, "Members can only update tasks assigned to themselves");
  }

  const memberAllowedFields = new Set(["status", "description"]);
  const attemptedFields = Object.keys(payload);

  const hasForbiddenField = attemptedFields.some((field) => !memberAllowedFields.has(field));

  if (hasForbiddenField) {
    throw new AppError(
      status.FORBIDDEN,
      "Members can only update task status and description on their assigned tasks"
    );
  }
};

const getTasks = async (
  req: Request
): Promise<{
  data: ITaskListItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}> => {
  try {
    const workspaceId = req.workspaceId!;
    const query = req.query as unknown as ITaskQuery;

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

    if (req.workspaceRole === "MEMBER") {
      andConditions.push({
        OR: [{ assignedToUserId: req.user!.id }, { createdByUserId: req.user!.id }],
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
      andConditions.push({ assignedToUserId: req.user!.id });
    }

    if (query.status) {
      andConditions.push({ status: query.status });
    }

    if (query.priority) {
      andConditions.push({ priority: query.priority });
    }

    if (query.overdue === "true") {
      andConditions.push({
        dueDate: { lt: new Date() },
      });

      if (!query.status) {
        andConditions.push({
          status: { not: "DONE" },
        });
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
        select: {
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
        },
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
        status: payload.status ?? "TODO",
        priority: payload.priority ?? "MEDIUM",
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

    await getScopedTaskOrThrow(req, taskId, workspaceId);

    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        workspaceId,
        deletedAt: null,
      },
      select: getTaskSelect,
    });

    if (!task) {
      throw new AppError(status.NOT_FOUND, "Task not found");
    }

    return task;
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

    const existingTask = await getScopedTaskOrThrow(req, taskId, workspaceId);

    assertTaskUpdatePermission(req, payload, existingTask);

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

    return task;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to update task");
  }
};

const deleteTask = async (req: Request): Promise<void> => {
  try {
    const workspaceId = req.workspaceId!;
    const taskId = req.params.taskId as string;

    await getScopedTaskOrThrow(req, taskId, workspaceId);

    if (req.workspaceRole === "MEMBER") {
      throw new AppError(status.FORBIDDEN, "Members do not have permission to delete tasks");
    }

    await prisma.task.update({
      where: { id: taskId },
      data: { deletedAt: new Date() },
    });
  } catch (error) {
    if (error instanceof AppError) throw error;

    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to delete task");
  }
};

export const TaskService = {
  getTasks,
  createTask,
  getTask,
  updateTask,
  deleteTask,
};
