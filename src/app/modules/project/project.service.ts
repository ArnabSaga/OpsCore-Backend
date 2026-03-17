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
  IAssignProjectMembersPayload,
  IAssignProjectMembersResponse,
  ICreateProjectPayload,
  IProjectListItem,
  IProjectMemberResponse,
  IProjectQuery,
  IProjectResponse,
  IProjectTaskListItem,
  IProjectTaskQuery,
  IUpdateProjectPayload,
} from "./project.interface";

const isDbConnectionError = (error: unknown) => {
  const prismaError = error as { code?: string };
  return prismaError?.code === "P1001" || prismaError?.code === "P1002";
};

const buildProjectBaseWhere = (workspaceId: string, includeArchived = false) => {
  return {
    workspaceId,
    deletedAt: null,
    ...(includeArchived ? {} : { archivedAt: null }),
  };
};

const getScopedProjectOrThrow = async (projectId: string, workspaceId: string) => {
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
      archivedAt: true,
      status: true,
      startDate: true,
      endDate: true,
    },
  });

  if (!project) {
    throw new AppError(status.NOT_FOUND, "Project not found");
  }

  return project;
};

const getProjects = async (
  req: Request
): Promise<{
  data: IProjectListItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}> => {
  try {
    const workspaceId = req.workspaceId!;
    const query = req.query as unknown as IProjectQuery;

    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 100);
    const skip = (page - 1) * limit;

    const archived = query.archived === "true";
    const sortBy = query.sortBy ?? "createdAt";
    const sortOrder = query.sortOrder === "asc" ? "asc" : "desc";

    const where: any = {
      ...buildProjectBaseWhere(workspaceId, archived),
    };

    if (query.searchTerm) {
      where.OR = [
        { name: { contains: query.searchTerm, mode: "insensitive" } },
        { description: { contains: query.searchTerm, mode: "insensitive" } },
        { clientName: { contains: query.searchTerm, mode: "insensitive" } },
      ];
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.clientName) {
      where.clientName = { contains: query.clientName, mode: "insensitive" };
    }

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
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
              tasks: true,
              members: true,
            },
          },
        },
      }),
      prisma.project.count({ where }),
    ]);

    return {
      data: projects,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (isDbConnectionError(error)) {
      throw new AppError(status.SERVICE_UNAVAILABLE, "Database connection failed");
    }
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to fetch projects");
  }
};

const createProject = async (req: Request): Promise<IProjectResponse> => {
  try {
    const workspaceId = req.workspaceId!;
    const createdByUserId = req.user!.id;
    const payload = req.body as ICreateProjectPayload;

    await assertPlanFeatureEnabled(workspaceId, "projects.create");
    await assertPlanLimitNotReached({
      workspaceId,
      limitKey: "projects",
      incrementBy: 1,
      customMessage: 'You have reached the "projects" limit for your current plan.',
    });

    if (payload.status === "ARCHIVED") {
      await assertPlanFeatureEnabled(workspaceId, "projects.archive");
    }

    const project = await prisma.project.create({
      data: {
        workspaceId,
        createdByUserId,
        name: payload.name.trim(),
        description: payload.description?.trim(),
        clientName: payload.clientName?.trim(),
        status: payload.status ?? "ACTIVE",
        startDate: payload.startDate ? new Date(payload.startDate) : undefined,
        endDate: payload.endDate ? new Date(payload.endDate) : undefined,
        ...(payload.status === "ARCHIVED" ? { archivedAt: new Date() } : {}),
      },
      include: {
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
        _count: {
          select: {
            tasks: true,
            members: true,
          },
        },
      },
    });

    const planContext = await resolveWorkspacePlanContext(workspaceId);

    return {
      ...project,
      planMeta: {
        workspacePlan: planContext.effectivePlan,
        isTrialActive: planContext.isTrialActive,
        trialStartsAt: planContext.trialStartedAt,
        trialEndsAt: planContext.trialEndsAt,
      },
    };
  } catch (error: any) {
    if (error instanceof AppError) throw error;

    if (isDbConnectionError(error)) {
      throw new AppError(status.SERVICE_UNAVAILABLE, "Database connection failed");
    }

    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to create project");
  }
};

const getProject = async (req: Request): Promise<IProjectResponse> => {
  try {
    const workspaceId = req.workspaceId!;
    const projectId = req.params.projectId as string;

    await getScopedProjectOrThrow(projectId, workspaceId);

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        workspaceId,
        deletedAt: null,
      },
      include: {
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
        _count: {
          select: {
            tasks: true,
            members: true,
          },
        },
      },
    });

    if (!project) {
      throw new AppError(status.NOT_FOUND, "Project not found");
    }

    return project;
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (isDbConnectionError(error)) {
      throw new AppError(status.SERVICE_UNAVAILABLE, "Database connection failed");
    }
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to fetch project");
  }
};

const updateProject = async (req: Request): Promise<IProjectResponse> => {
  try {
    const workspaceId = req.workspaceId!;
    const projectId = req.params.projectId as string;
    const payload = req.body as IUpdateProjectPayload;

    const existingProject = await getScopedProjectOrThrow(projectId, workspaceId);

    const nextStartDate =
      payload.startDate !== undefined
        ? payload.startDate
          ? new Date(payload.startDate)
          : null
        : existingProject.startDate;

    const nextEndDate =
      payload.endDate !== undefined
        ? payload.endDate
          ? new Date(payload.endDate)
          : null
        : existingProject.endDate;

    if (nextStartDate && nextEndDate && nextEndDate < nextStartDate) {
      throw new AppError(status.BAD_REQUEST, "End date cannot be earlier than start date");
    }

    const shouldArchive = payload.archived === true || payload.status === "ARCHIVED";
    const shouldUnarchive = payload.archived === false && existingProject.archivedAt !== null;

    if (shouldArchive || shouldUnarchive) {
      await assertPlanFeatureEnabled(workspaceId, "projects.archive");
    }

    const project = await prisma.project.update({
      where: { id: projectId },
      data: {
        ...(payload.name !== undefined && { name: payload.name.trim() }),
        ...(payload.description !== undefined && {
          description: payload.description === null ? null : payload.description.trim(),
        }),
        ...(payload.clientName !== undefined && {
          clientName: payload.clientName === null ? null : payload.clientName.trim(),
        }),
        ...(payload.status !== undefined && { status: payload.status }),
        ...(payload.startDate !== undefined && {
          startDate: payload.startDate ? new Date(payload.startDate) : null,
        }),
        ...(payload.endDate !== undefined && {
          endDate: payload.endDate ? new Date(payload.endDate) : null,
        }),
        ...(shouldArchive && { archivedAt: new Date(), status: "ARCHIVED" }),
        ...(shouldUnarchive && {
          archivedAt: null,
          ...(payload.status === undefined ? { status: "ACTIVE" } : {}),
        }),
      },
      include: {
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
        _count: {
          select: {
            tasks: true,
            members: true,
          },
        },
      },
    });

    return project;
  } catch (error: any) {
    if (error instanceof AppError) throw error;

    if (isDbConnectionError(error)) {
      throw new AppError(status.SERVICE_UNAVAILABLE, "Database connection failed");
    }

    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to update project");
  }
};

const deleteProject = async (req: Request): Promise<void> => {
  try {
    const workspaceId = req.workspaceId!;
    const projectId = req.params.projectId as string;

    await getScopedProjectOrThrow(projectId, workspaceId);

    await prisma.project.update({
      where: { id: projectId },
      data: { deletedAt: new Date() },
    });
  } catch (error: any) {
    if (error instanceof AppError) throw error;

    if (isDbConnectionError(error)) {
      throw new AppError(status.SERVICE_UNAVAILABLE, "Database connection failed");
    }

    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to delete project");
  }
};

const getProjectTasks = async (
  req: Request
): Promise<{
  data: IProjectTaskListItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}> => {
  try {
    const workspaceId = req.workspaceId!;
    const projectId = req.params.projectId as string;
    const query = req.query as unknown as IProjectTaskQuery;

    await getScopedProjectOrThrow(projectId, workspaceId);

    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 100);
    const skip = (page - 1) * limit;
    const sortBy = query.sortBy ?? "createdAt";
    const sortOrder = query.sortOrder === "asc" ? "asc" : "desc";

    const where: any = {
      workspaceId,
      projectId,
      deletedAt: null,
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.assignedToUserId) {
      where.assignedToUserId = query.assignedToUserId;
    }

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          dueDate: true,
          createdAt: true,
          updatedAt: true,
          assignedToUser: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
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
    if (isDbConnectionError(error)) {
      throw new AppError(status.SERVICE_UNAVAILABLE, "Database connection failed");
    }
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to fetch project tasks");
  }
};

const getProjectMembers = async (req: Request): Promise<IProjectMemberResponse[]> => {
  try {
    const workspaceId = req.workspaceId!;
    const projectId = req.params.projectId as string;

    await getScopedProjectOrThrow(projectId, workspaceId);

    const members = await prisma.projectMember.findMany({
      where: {
        workspaceId,
        projectId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return members;
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (isDbConnectionError(error)) {
      throw new AppError(status.SERVICE_UNAVAILABLE, "Database connection failed");
    }
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to fetch project members");
  }
};

const assignProjectMembers = async (req: Request): Promise<IAssignProjectMembersResponse> => {
  try {
    const workspaceId = req.workspaceId!;
    const projectId = req.params.projectId as string;
    const { userIds } = req.body as IAssignProjectMembersPayload;

    await assertPlanFeatureEnabled(workspaceId, "projects.assignMembers");
    await getScopedProjectOrThrow(projectId, workspaceId);

    const workspaceMembers = await prisma.workspaceMember.findMany({
      where: {
        workspaceId,
        userId: { in: userIds },
        status: "ACTIVE",
      },
      select: {
        userId: true,
      },
    });

    const activeWorkspaceUserIds = workspaceMembers.map((member) => member.userId);

    if (activeWorkspaceUserIds.length !== userIds.length) {
      throw new AppError(
        status.BAD_REQUEST,
        "All assigned users must be active members of the current workspace"
      );
    }

    const existingProjectMembers = await prisma.projectMember.findMany({
      where: {
        workspaceId,
        projectId,
        userId: { in: userIds },
      },
      select: {
        userId: true,
      },
    });

    const existingUserIdSet = new Set(existingProjectMembers.map((member) => member.userId));
    const userIdsToAdd = userIds.filter((userId) => !existingUserIdSet.has(userId));

    if (userIdsToAdd.length > 0) {
      await prisma.projectMember.createMany({
        data: userIdsToAdd.map((userId) => ({
          workspaceId,
          projectId,
          userId,
        })),
        skipDuplicates: true,
      });
    }

    const totalMembers = await prisma.projectMember.count({
      where: {
        workspaceId,
        projectId,
      },
    });

    return {
      projectId,
      addedCount: userIdsToAdd.length,
      totalMembers,
    };
  } catch (error: any) {
    if (error instanceof AppError) throw error;

    if (isDbConnectionError(error)) {
      throw new AppError(status.SERVICE_UNAVAILABLE, "Database connection failed");
    }

    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to assign project members");
  }
};

export const ProjectService = {
  getProjects,
  createProject,
  getProject,
  updateProject,
  deleteProject,
  getProjectTasks,
  getProjectMembers,
  assignProjectMembers,
};
