import { fromNodeHeaders } from "better-auth/node";
import { Request } from "express";
import status from "http-status";
import { WorkspaceMemberRole, WorkspaceMemberStatus } from "../../constants/role";
import { SubscriptionPlan } from "../../constants/subscription";
import { DEFAULT_WORKSPACE_PLAN, PLAN_FEATURES } from "../../config/planFeatures";
import AppError from "../../errors/AppError";
import { auth } from "../../lib/auth";
import { prisma } from "../../lib/prisma";
import {
  assertUserCanCreateWorkspace,
  resolveWorkspacePlanContext,
} from "../../utils/checkPlanLimit";
import { generateSlug } from "../../utils/generateSlug";
import {
  ICreateWorkspacePayload,
  IMyWorkspaceResponse,
  ISwitchWorkspaceResponse,
  IUpdateWorkspacePayload,
  IWorkspaceResponse,
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

const getWorkspace = async (req: Request): Promise<IWorkspaceResponse> => {
  try {
    const workspaceId = req.params.workspaceId as string;

    const workspace = await prisma.workspace.findFirst({
      where: { id: workspaceId, deletedAt: null },
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

    if (!workspace) {
      throw new AppError(status.NOT_FOUND, "Workspace not found");
    }

    const planContext = await resolveWorkspacePlanContext(workspaceId);

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
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to delete workspace");
  }
};

export const WorkspaceService = {
  getMyWorkspaces,
  createWorkspace,
  getWorkspace,
  updateWorkspace,
  switchWorkspace,
  deleteWorkspace,
};
