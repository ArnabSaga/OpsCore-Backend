import { fromNodeHeaders } from "better-auth/node";
import { Request } from "express";
import status from "http-status";
import { WorkspaceMemberRole, WorkspaceMemberStatus } from "../../constants/role";
import { SubscriptionPlan, SubscriptionStatus } from "../../constants/subscription";
import { DEFAULT_WORKSPACE_PLAN, PLAN_FEATURES } from "../../config/planFeatures";
import AppError from "../../errors/AppError";
import { auth } from "../../lib/auth";
import { prisma } from "../../lib/prisma";
import { Prisma } from "../../../generated/prisma/client";
import {
  assertUserCanCreateWorkspace,
  resolveWorkspacePlanContext,
} from "../../utils/checkPlanLimit";
import { generateSlug } from "../../utils/generateSlug";
import { auditLog } from "../../utils/auditLog";
import {
  ICreateWorkspacePayload,
  IMyWorkspaceResponse,
  ISwitchWorkspaceResponse,
  IUpdateWorkspacePayload,
  IWorkspaceResponse,
  IEnhancedWorkspaceResponse,
  IUpdateGeneralSettingsPayload,
  IUpdateBrandingPayload,
} from "./workspace.interface";

const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const getMonthRange = (referenceDate = new Date()) => {
  const start = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  const end = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 1);
  return { start, end };
};

const generateUniqueWorkspaceSlug = async (
  workspaceName: string,
  excludeWorkspaceId?: string
): Promise<string> => {
  const baseSlug = generateSlug(workspaceName);
  let slug = baseSlug;
  let counter = 1;

  while (
    await prisma.workspace.findFirst({
      where: {
        slug,
        ...(excludeWorkspaceId ? { id: { not: excludeWorkspaceId } } : {}),
      },
      select: { id: true },
    })
  ) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
};

const getMyWorkspaces = async (req: Request): Promise<IMyWorkspaceResponse[]> => {
  try {
    const userId = req.user!.id;

    const sessionData = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    const activeWorkspaceId = sessionData?.session?.id
      ? ((
          await prisma.session.findUnique({
            where: { id: sessionData.session.id },
            select: { activeWorkspaceId: true },
          })
        )?.activeWorkspaceId ?? null)
      : null;

    const memberships = await prisma.workspaceMember.findMany({
      where: {
        userId,
        workspace: { deletedAt: null },
      },
      select: {
        role: true,
        status: true,
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
            createdAt: true,
            updatedAt: true,
            createdByUserId: true,
            _count: { select: { members: true } },
          },
        },
      },
      orderBy: { workspace: { createdAt: "asc" } },
    });

    const workspaceIds = memberships.map((membership) => membership.workspace.id);

    const planMetaMap = new Map<
      string,
      {
        basePlan: SubscriptionPlan;
        effectivePlan: SubscriptionPlan;
        isTrialActive: boolean;
        trialStartsAt: Date | null;
        trialEndsAt: Date | null;
      }
    >();

    await Promise.all(
      workspaceIds.map(async (workspaceId) => {
        const planContext = await resolveWorkspacePlanContext(workspaceId);

        planMetaMap.set(workspaceId, {
          basePlan: planContext.basePlan,
          effectivePlan: planContext.effectivePlan,
          isTrialActive: planContext.isTrialActive,
          trialStartsAt: planContext.trialStartedAt,
          trialEndsAt: planContext.trialEndsAt,
        });
      })
    );

    return memberships.map((membership) => ({
      ...membership.workspace,
      role: membership.role,
      status: membership.status,
      isActiveWorkspace: membership.workspace.id === activeWorkspaceId,
      planMeta: planMetaMap.get(membership.workspace.id),
    }));
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to fetch workspaces");
  }
};

const createWorkspace = async (req: Request): Promise<IWorkspaceResponse> => {
  try {
    const userId = req.user!.id;
    const { name } = req.body as ICreateWorkspacePayload;

    await assertUserCanCreateWorkspace(userId);

    const slug = await generateUniqueWorkspaceSlug(name);

    const now = new Date();
    const billingCycle = getMonthRange(now);
    const freePlanTrialPolicy = PLAN_FEATURES[DEFAULT_WORKSPACE_PLAN].trial;

    const trialStartsAt = freePlanTrialPolicy.enabled ? now : null;
    const trialEndsAt =
      freePlanTrialPolicy.enabled && freePlanTrialPolicy.durationDays > 0
        ? addDays(now, freePlanTrialPolicy.durationDays)
        : null;

    const sessionData = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    const sessionId = sessionData?.session?.id ?? null;

    const workspace = await prisma.$transaction(async (tx) => {
      const created = await tx.workspace.create({
        data: {
          name,
          slug,
          createdByUserId: userId,
          trialStartsAt,
          trialEndsAt,
          billingCycleStartsAt: billingCycle.start,
          billingCycleEndsAt: billingCycle.end,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          createdAt: true,
          updatedAt: true,
          createdByUserId: true,
          _count: { select: { members: true } },
        },
      });

      await tx.workspaceMember.create({
        data: {
          workspaceId: created.id,
          userId,
          role: WorkspaceMemberRole.OWNER,
          status: WorkspaceMemberStatus.ACTIVE,
          addedByUserId: userId,
        },
      });

      if (sessionId) {
        await tx.session.update({
          where: { id: sessionId },
          data: { activeWorkspaceId: created.id },
        });
      }

      return created;
    });

    const planContext = await resolveWorkspacePlanContext(workspace.id);

    await auditLog({
      workspaceId: workspace.id,
      userId: req.user!.id,
      action: "WORKSPACE_CREATED",
      entityType: "WORKSPACE",
      entityId: workspace.id,
    });

    return {
      ...workspace,
      planMeta: {
        basePlan: planContext.basePlan,
        effectivePlan: planContext.effectivePlan,
        isTrialActive: planContext.isTrialActive,
        trialStartsAt: planContext.trialStartedAt,
        trialEndsAt: planContext.trialEndsAt,
      },
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to create workspace");
  }
};

const getWorkspace = async (req: Request): Promise<IEnhancedWorkspaceResponse> => {
  try {
    const workspaceId = req.params.workspaceId as string;
    const userId = req.user!.id;

    const workspace = await prisma.workspace.findFirst({
      where: { id: workspaceId, deletedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        updatedAt: true,
        createdByUserId: true,
        createdByUser: {
          select: { id: true, name: true, email: true, image: true },
        },
        _count: {
          select: {
            members: true,
            invitations: true,
            projects: true,
            tasks: true,
          },
        },
      },
    });

    if (!workspace) {
      throw new AppError(status.NOT_FOUND, "Workspace not found");
    }

    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId },
      select: { role: true, status: true },
    });

    const activeMembersCount = await prisma.workspaceMember.count({
      where: { workspaceId, status: WorkspaceMemberStatus.ACTIVE },
    });

    const pendingInvitationsCount = await prisma.workspaceInvitation.count({
      where: { workspaceId, status: "PENDING" }, // Prisma enum InvitationStatus
    });

    const sessionData = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    
    const isActiveWorkspace = (sessionData?.session as any)?.activeWorkspaceId === workspaceId;
    const planContext = await resolveWorkspacePlanContext(workspaceId);

    const isOwner = workspace.createdByUserId === userId;
    const permissions = membership?.status === WorkspaceMemberStatus.ACTIVE 
      ? resolveCapabilities(membership.role, isOwner) 
      : null;

    return {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
      createdByUserId: workspace.createdByUserId,
      createdBy: workspace.createdByUser,
      role: membership?.role ?? null,
      status: membership?.status ?? null,
      isActiveWorkspace,
      permissions,
      counts: {
        members: workspace._count.members,
        activeMembers: activeMembersCount,
        invitations: workspace._count.invitations,
        pendingInvitations: pendingInvitationsCount,
        projects: workspace._count.projects,
        tasks: workspace._count.tasks,
      },
      planMeta: {
        basePlan: planContext.basePlan,
        effectivePlan: planContext.effectivePlan,
        isTrialActive: planContext.isTrialActive,
        trialStartsAt: planContext.trialStartedAt,
        trialEndsAt: planContext.trialEndsAt,
      },
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to fetch workspace");
  }
};

const updateWorkspace = async (req: Request): Promise<IWorkspaceResponse> => {
  try {
    const workspaceId = req.params.workspaceId as string;
    const { name } = req.body as IUpdateWorkspacePayload;

    const workspace = await prisma.workspace.findFirst({
      where: { id: workspaceId, deletedAt: null },
      select: { id: true, name: true },
    });

    if (!workspace) {
      throw new AppError(status.NOT_FOUND, "Workspace not found");
    }

    const updateData: { name?: string; slug?: string } = {};

    if (name && name !== workspace.name) {
      updateData.name = name;
      updateData.slug = await generateUniqueWorkspaceSlug(name, workspaceId);
    }

    const updated = await prisma.workspace.update({
      where: { id: workspaceId },
      data: updateData,
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        updatedAt: true,
        createdByUserId: true,
        _count: { select: { members: true } },
      },
    });

    const planContext = await resolveWorkspacePlanContext(workspaceId);

    await auditLog({
      workspaceId,
      userId: req.user!.id,
      action: "WORKSPACE_UPDATED",
      entityType: "WORKSPACE",
      entityId: workspaceId,
      metadata: updateData as any,
    });

    return {
      ...updated,
      planMeta: {
        basePlan: planContext.basePlan,
        effectivePlan: planContext.effectivePlan,
        isTrialActive: planContext.isTrialActive,
        trialStartsAt: planContext.trialStartedAt,
        trialEndsAt: planContext.trialEndsAt,
      },
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to update workspace");
  }
};

const switchWorkspace = async (req: Request): Promise<ISwitchWorkspaceResponse> => {
  try {
    const workspaceId = req.params.workspaceId as string;

    const sessionData = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!sessionData?.session) {
      throw new AppError(status.UNAUTHORIZED, "Session not found");
    }

    const membership = await prisma.workspaceMember.findFirst({
      where: {
        userId: req.user!.id,
        workspaceId,
        status: WorkspaceMemberStatus.ACTIVE,
      },
      select: {
        role: true,
        workspace: {
          select: {
            id: true,
            name: true,
            deletedAt: true,
          },
        },
      },
    });

    if (!membership) {
      throw new AppError(status.FORBIDDEN, "You are not an active member of this workspace");
    }

    if (membership.workspace.deletedAt) {
      throw new AppError(status.NOT_FOUND, "Workspace no longer exists");
    }

    await prisma.session.update({
      where: { id: sessionData.session.id },
      data: { activeWorkspaceId: workspaceId },
    });

    return {
      workspaceId: membership.workspace.id,
      workspaceName: membership.workspace.name,
      role: membership.role,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to switch workspace");
  }
};

const deleteWorkspace = async (req: Request): Promise<void> => {
  try {
    const workspaceId = req.params.workspaceId as string;
    const { confirmName } = req.body as { confirmName?: string };

    const workspace = await prisma.workspace.findFirst({
      where: { id: workspaceId, deletedAt: null },
      select: { id: true, name: true },
    });

    if (!workspace) {
      throw new AppError(status.NOT_FOUND, "Workspace not found");
    }

    if (confirmName !== workspace.name) {
      throw new AppError(status.BAD_REQUEST, "Confirmation name does not match workspace name");
    }

    const activeSubscription = await prisma.subscription.findFirst({
      where: { workspaceId, status: SubscriptionStatus.ACTIVE },
    });

    if (activeSubscription) {
      throw new AppError(status.BAD_REQUEST, "Cannot delete workspace with an active subscription");
    }

    await prisma.$transaction(async (tx) => {
      await tx.workspace.update({
        where: { id: workspaceId },
        data: { deletedAt: new Date() },
      });

      await tx.session.updateMany({
        where: { activeWorkspaceId: workspaceId },
        data: { activeWorkspaceId: null },
      });
    });

    await auditLog({
      workspaceId,
      userId: req.user!.id,
      action: "WORKSPACE_DELETED",
      entityType: "WORKSPACE",
      entityId: workspaceId,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to delete workspace");
  }
};

const getGeneralSettings = async (req: Request) => {
  try {
    const workspaceId = req.params.workspaceId as string;
    const workspace = await prisma.workspace.findFirst({
      where: { id: workspaceId, deletedAt: null },
      select: {
        id: true,
        name: true,
        description: true,
        timezone: true,
        currency: true,
        supportEmail: true,
        billingEmail: true,
      },
    });

    if (!workspace) throw new AppError(status.NOT_FOUND, "Workspace not found");
    return workspace;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to fetch general settings");
  }
};

const updateGeneralSettings = async (req: Request) => {
  try {
    const workspaceId = req.params.workspaceId as string;
    const updateData = req.body as Partial<IUpdateGeneralSettingsPayload>;

    const workspace = await prisma.workspace.findFirst({
      where: { id: workspaceId, deletedAt: null },
      select: { id: true, name: true },
    });

    if (!workspace) throw new AppError(status.NOT_FOUND, "Workspace not found");

    if (updateData.name && updateData.name !== workspace.name) {
      (updateData as any).slug = await generateUniqueWorkspaceSlug(updateData.name, workspaceId);
    }

    const updated = await prisma.workspace.update({
      where: { id: workspaceId },
      data: updateData,
      select: {
        id: true,
        name: true,
        description: true,
        timezone: true,
        currency: true,
        supportEmail: true,
        billingEmail: true,
      },
    });

    return updated;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to update general settings");
  }
};

const getBranding = async (req: Request) => {
  try {
    const workspaceId = req.params.workspaceId as string;
    const workspace = await prisma.workspace.findFirst({
      where: { id: workspaceId, deletedAt: null },
      select: {
        id: true,
        logoUrl: true,
        faviconUrl: true,
        primaryColor: true,
        accentColor: true,
        customDomain: true,
        emailBrandName: true,
      },
    });

    if (!workspace) throw new AppError(status.NOT_FOUND, "Workspace not found");
    return workspace;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to fetch branding settings");
  }
};

const updateBranding = async (req: Request) => {
  try {
    const workspaceId = req.params.workspaceId as string;
    const updateData = req.body as Partial<IUpdateBrandingPayload>;

    const workspace = await prisma.workspace.findFirst({
      where: { id: workspaceId, deletedAt: null },
      select: { id: true },
    });

    if (!workspace) throw new AppError(status.NOT_FOUND, "Workspace not found");

    const updated = await prisma.workspace.update({
      where: { id: workspaceId },
      data: updateData,
      select: {
        id: true,
        logoUrl: true,
        faviconUrl: true,
        primaryColor: true,
        accentColor: true,
        customDomain: true,
        emailBrandName: true,
      },
    });

    return updated;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to update branding settings");
  }
};

const getSummary = async (req: Request) => {
  try {
    const workspaceId = req.params.workspaceId as string;
    
    // For now we return a dummy structure that mimics the user's expected shape.
    // Later we can enhance permissions and billing properties using capability resolver.
    const workspace = await prisma.workspace.findFirst({
      where: { id: workspaceId, deletedAt: null },
      select: { name: true, logoUrl: true, customDomain: true },
    });

    if (!workspace) throw new AppError(status.NOT_FOUND, "Workspace not found");

    const planContext = await resolveWorkspacePlanContext(workspaceId);

    return {
      general: { canEdit: true, name: workspace.name },
      branding: {
        enabled: true,
        configured: !!(workspace.logoUrl || workspace.customDomain),
      },
      permissions: { enabled: true, customPoliciesSupported: false },
      billing: { canManage: true, plan: planContext.effectivePlan },
      dangerZone: { canDelete: true },
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to fetch settings summary");
  }
};

import { ROLE_CAPABILITIES, resolveCapabilities } from "./workspace.capabilities";

const getCapabilities = async (req: Request) => {
  try {
    const workspaceId = req.params.workspaceId as string;
    const userId = req.user!.id;

    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId, status: WorkspaceMemberStatus.ACTIVE },
    });

    if (!membership) {
      throw new AppError(status.FORBIDDEN, "Not an active member");
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { createdByUserId: true },
    });

    const isOwner = workspace?.createdByUserId === userId;
    return resolveCapabilities(membership.role, isOwner);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to fetch capabilities");
  }
};

const getPermissions = async (req: Request) => {
  try {
    return {
      roles: [
        { role: "OWNER", capabilities: ROLE_CAPABILITIES.OWNER },
        { role: "ADMIN", capabilities: ROLE_CAPABILITIES.ADMIN },
        { role: "MEMBER", capabilities: ROLE_CAPABILITIES.MEMBER },
      ],
      featureGates: {
        memberManagement: true,
        advancedPermissions: false,
      },
    };
  } catch (error) {
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to fetch permissions");
  }
};

const archiveWorkspace = async (req: Request): Promise<void> => {
  try {
    const workspaceId = req.params.workspaceId as string;
    
    // Archive currently functions exactly like soft-delete until a dedicated isArchived flag is added
    const workspace = await prisma.workspace.findFirst({
      where: { id: workspaceId, deletedAt: null },
      select: { id: true },
    });

    if (!workspace) {
      throw new AppError(status.NOT_FOUND, "Workspace not found");
    }

    await prisma.$transaction(async (tx) => {
      await tx.workspace.update({
        where: { id: workspaceId },
        data: { deletedAt: new Date() },
      });

      await tx.session.updateMany({
        where: { activeWorkspaceId: workspaceId },
        data: { activeWorkspaceId: null },
      });
    });

    await auditLog({
      workspaceId,
      userId: req.user!.id,
      action: "WORKSPACE_ARCHIVED",
      entityType: "WORKSPACE",
      entityId: workspaceId,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to archive workspace");
  }
};

const getActivityLogs = async (req: Request) => {
  try {
    const workspaceId = req.params.workspaceId as string;
    const query = req.query as { limit?: string; page?: string };
    
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
    const page = Math.max(Number(query.page) || 1, 1);
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where: { workspaceId },
        include: {
          user: {
            select: { id: true, name: true, email: true, image: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip,
      }),
      prisma.activityLog.count({ where: { workspaceId } }),
    ]);

    return {
      items: logs,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to fetch activity logs");
  }
};

const getPlatformWorkspaces = async (req: Request) => {
  try {
    const isSuperAdmin = req.user?.systemRole === "SUPER_ADMIN";
    if (!isSuperAdmin) {
      throw new AppError(status.FORBIDDEN, "Only super administrators can access all workspaces");
    }

    const query = req.query as { limit?: string; page?: string; search?: string };
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
    const page = Math.max(Number(query.page) || 1, 1);
    const skip = (page - 1) * limit;
    const search = query.search?.trim();

    const where: Prisma.WorkspaceWhereInput = {
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { slug: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [workspaces, total] = await Promise.all([
      prisma.workspace.findMany({
        where,
        include: {
          createdByUser: {
            select: { id: true, name: true, email: true, image: true },
          },
          _count: {
            select: {
              members: true,
              projects: true,
              tasks: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip,
      }),
      prisma.workspace.count({ where }),
    ]);

    return {
      items: workspaces,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to fetch platform workspaces");
  }
};

export const WorkspaceService = {
  getMyWorkspaces,
  getPlatformWorkspaces,
  createWorkspace,
  getWorkspace,
  updateWorkspace,
  switchWorkspace,
  deleteWorkspace,
  archiveWorkspace,
  getGeneralSettings,
  updateGeneralSettings,
  getBranding,
  updateBranding,
  getSummary,
  getCapabilities,
  getPermissions,
  getActivityLogs,
};
