import { Request } from "express";
import status from "http-status";
import AppError from "../../errors/AppError";
import { ProjectStatus } from "../../constants/task";
import { WorkspaceMemberRole, WorkspaceMemberStatus } from "../../constants/role";
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
  IProjectSummary,
  IProjectTaskListItem,
  IProjectTaskQuery,
  IUpdateProjectPayload,
} from "./project.interface";

const getTaskSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  priority: true,
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


const buildProjectBaseWhere = (workspaceId: string, includeArchived = false) => {
  return {
    workspaceId,
    deletedAt: null,
    ...(includeArchived ? {} : { archivedAt: null }),
  };
};

const getScopedProjectOrThrow = async (
  userId: string,
  workspaceRole: string,
  projectId: string,
  workspaceId: string
) => {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      workspaceId,
      deletedAt: null,
      ...(workspaceRole === WorkspaceMemberRole.MEMBER
        ? {
            OR: [{ members: { some: { userId } } }, { tasks: { some: { assignedToUserId: userId } } }],
          }
        : {}),
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
    throw new AppError(status.NOT_FOUND, "Project not found or access denied");
  }

  return project;
};

const getProjects = async (
  workspaceId: string,
  workspaceRole: string,
  userId: string,
  query: IProjectQuery
): Promise<{
  data: IProjectListItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}> => {
  try {

    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 100);
    const skip = (page - 1) * limit;

    const archived = query.archived === "true";
    const sortBy = query.sortBy ?? "createdAt";
    const sortOrder = query.sortOrder === "asc" ? "asc" : "desc";

    const andConditions: any[] = [buildProjectBaseWhere(workspaceId, archived)];

    if (workspaceRole === WorkspaceMemberRole.MEMBER) {
      andConditions.push({
        OR: [
          { members: { some: { userId } } },
          { tasks: { some: { assignedToUserId: userId } } },
        ],
      });
    }

    if (query.searchTerm) {
      andConditions.push({
        OR: [
          { name: { contains: query.searchTerm, mode: "insensitive" } },
          { description: { contains: query.searchTerm, mode: "insensitive" } },
          { clientName: { contains: query.searchTerm, mode: "insensitive" } },
        ],
      });
    }

    if (query.status) {
      andConditions.push({ status: query.status });
    }

    if (query.clientName) {
      andConditions.push({ clientName: { contains: query.clientName, mode: "insensitive" } });
    }

    const where = { AND: andConditions };

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
              tasks: {
                where: { deletedAt: null },
              },
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

    if (payload.status === ProjectStatus.ARCHIVED) {
      await assertPlanFeatureEnabled(workspaceId, "projects.archive");
    }

    const project = await prisma.project.create({
      data: {
        workspaceId,
        createdByUserId,
        name: payload.name.trim(),
        description: payload.description?.trim(),
        clientName: payload.clientName?.trim(),
        status: payload.status ?? ProjectStatus.ACTIVE,
        startDate: payload.startDate ? new Date(payload.startDate) : undefined,
        endDate: payload.endDate ? new Date(payload.endDate) : undefined,
        ...(payload.status === ProjectStatus.ARCHIVED ? { archivedAt: new Date() } : {}),
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
            tasks: {
              where: { deletedAt: null },
            },
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

    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to create project");
  }
};

const getProject = async (req: Request): Promise<IProjectResponse> => {
  try {
    const workspaceId = req.workspaceId!;
    const projectId = req.params.projectId as string;

    await getScopedProjectOrThrow(req.user!.id, req.workspaceRole!, projectId, workspaceId);

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        workspaceId,
        deletedAt: null,
        ...(req.workspaceRole === "MEMBER"
          ? {
              OR: [
                {
                  members: {
                    some: {
                      userId: req.user!.id,
                    },
                  },
                },
                {
                  tasks: {
                    some: {
                      assignedToUserId: req.user!.id,
                    },
                  },
                },
              ],
            }
          : {}),
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
            tasks: {
              where: { deletedAt: null },
            },
            members: true,
          },
        },
      },
    });

    if (!project) {
      throw new AppError(status.NOT_FOUND, "Project not found");
    }

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
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to fetch project");
  }
};

const updateProject = async (req: Request): Promise<IProjectResponse> => {
  try {
    const workspaceId = req.workspaceId!;
    const projectId = req.params.projectId as string;
    const payload = req.body as IUpdateProjectPayload;

    const existingProject = await getScopedProjectOrThrow(req.user!.id, req.workspaceRole!, projectId, workspaceId);

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

    const shouldArchive = payload.archived === true || payload.status === ProjectStatus.ARCHIVED;
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
        ...(shouldArchive && { archivedAt: new Date(), status: ProjectStatus.ARCHIVED }),
        ...(shouldUnarchive && {
          archivedAt: null,
          ...(payload.status === undefined ? { status: ProjectStatus.ACTIVE } : {}),
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
            tasks: {
              where: { deletedAt: null },
            },
            members: true,
          },
        },
      },
    });

    return project;
  } catch (error: any) {
    if (error instanceof AppError) throw error;

    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to update project");
  }
};

const deleteProject = async (req: Request): Promise<void> => {
  try {
    const workspaceId = req.workspaceId!;
    const projectId = req.params.projectId as string;

    await getScopedProjectOrThrow(req.user!.id, req.workspaceRole!, projectId, workspaceId);

    await prisma.$transaction(async (tx) => {
      await tx.project.update({
        where: { id: projectId },
        data: { deletedAt: new Date() },
      });

      await tx.task.updateMany({
        where: { projectId },
        data: { deletedAt: new Date() },
      });

      await tx.projectMember.deleteMany({
        where: { projectId },
      });
    });
  } catch (error: any) {
    if (error instanceof AppError) throw error;

    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to delete project");
  }
};

const getProjectTasks = async (
  workspaceId: string,
  workspaceRole: string,
  userId: string,
  projectId: string,
  query: IProjectTaskQuery
): Promise<{
  data: IProjectTaskListItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}> => {
  try {

    await getScopedProjectOrThrow(userId, workspaceRole, projectId, workspaceId);

    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 100);
    const skip = (page - 1) * limit;
    const sortBy = query.sortBy ?? "createdAt";
    const sortOrder = query.sortOrder === "asc" ? "asc" : "desc";

    const where: any = {
      workspaceId,
      projectId,
      deletedAt: null,
      project: {
        deletedAt: null,
      },
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
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to fetch project tasks");
  }
};

const getProjectMembers = async (req: Request): Promise<IProjectMemberResponse[]> => {
  try {
    const workspaceId = req.workspaceId!;
    const projectId = req.params.projectId as string;

    await getScopedProjectOrThrow(req.user!.id, req.workspaceRole!, projectId, workspaceId);

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
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to fetch project members");
  }
};

const assignProjectMembers = async (req: Request): Promise<IAssignProjectMembersResponse> => {
  try {
    const workspaceId = req.workspaceId!;
    const projectId = req.params.projectId as string;
    const { userIds } = req.body as IAssignProjectMembersPayload;

    await assertPlanFeatureEnabled(workspaceId, "projects.assignMembers");
    const project = await getScopedProjectOrThrow(req.user!.id, req.workspaceRole!, projectId, workspaceId);

    if (project.archivedAt || project.status === ProjectStatus.ARCHIVED) {
      throw new AppError(status.BAD_REQUEST, "Cannot assign members to an archived project");
    }

    const workspaceMembers = await prisma.workspaceMember.findMany({
      where: {
        workspaceId,
        userId: { in: userIds },
        status: WorkspaceMemberStatus.ACTIVE,
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

    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to assign project members");
  }
};

const removeProjectMember = async (
  userId: string,
  workspaceRole: string,
  projectId: string,
  memberIdToRemove: string,
  workspaceId: string
): Promise<void> => {
  try {
    await getScopedProjectOrThrow(userId, workspaceRole, projectId, workspaceId);

    const projectMember = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: memberIdToRemove,
        },
      },
    });

    if (!projectMember) {
      throw new AppError(status.NOT_FOUND, "Project member not found");
    }

    if (workspaceRole === WorkspaceMemberRole.MEMBER && userId !== memberIdToRemove) {
      throw new AppError(status.FORBIDDEN, "You can only remove yourself from this project");
    }

    await prisma.projectMember.delete({
      where: {
        projectId_userId: {
          projectId,
          userId: memberIdToRemove,
        },
      },
    });
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to remove project member");
  }
};

const getProjectSummary = async (
  userId: string,
  workspaceRole: string,
  projectId: string,
  workspaceId: string
): Promise<IProjectSummary> => {
  try {
    await getScopedProjectOrThrow(userId, workspaceRole, projectId, workspaceId);

    const [totalTasks, openTasks, completedTasks, overdueTasks, recentActivity] =
      await Promise.all([
        prisma.task.count({
          where: { projectId, workspaceId, deletedAt: null },
        }),
        prisma.task.count({
          where: {
            status: { not: "DONE" },
            projectId,
            workspaceId,
            deletedAt: null,
          },
        }),
        prisma.task.count({
          where: {
            status: "DONE",
            projectId,
            workspaceId,
            deletedAt: null,
          },
        }),
        prisma.task.count({
          where: {
            status: { not: "DONE" },
            dueDate: { lt: new Date() },
            projectId,
            workspaceId,
            deletedAt: null,
          },
        }),
        prisma.task.findMany({
          where: { projectId, workspaceId, deletedAt: null },
          orderBy: { updatedAt: "desc" },
          take: 5,
          select: getTaskSelect,
        }),
      ]);

    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
      totalTasks,
      openTasks,
      completedTasks,
      overdueTasks,
      completionRate,
      recentActivity,
    };
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to fetch project summary");
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
  removeProjectMember,
  getProjectSummary,
};

