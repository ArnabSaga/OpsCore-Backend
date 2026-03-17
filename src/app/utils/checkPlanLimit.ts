import status from "http-status";
import AppError from "../errors/AppError";
import { prisma } from "../lib/prisma";
import {
  DEFAULT_WORKSPACE_PLAN,
  PLAN_FEATURES,
  PlanFeatureKey,
  PlanLimitKey,
  RateLimitActionKey,
  WorkspacePlan,
  getHigherWorkspacePlan,
  isKnownWorkspacePlan,
} from "../config/planFeatures";
import {
  SubscriptionPlan,
  SubscriptionStatus,
  WorkspaceMemberRole,
} from "../../generated/prisma/enums";

type WorkspacePlanRecord = {
  id: string;
  subscriptionPlan: SubscriptionPlan;
  createdAt: Date;
  deletedAt: Date | null;
  trialStartsAt: Date | null;
  trialEndsAt: Date | null;
  planOverride: SubscriptionPlan | null;
  planOverrideExpiresAt: Date | null;
  billingCycleStartsAt: Date | null;
  billingCycleEndsAt: Date | null;
};

export interface WorkspacePlanContext {
  workspaceId: string;
  basePlan: WorkspacePlan;
  effectivePlan: WorkspacePlan;
  isTrialActive: boolean;
  trialStartedAt: Date | null;
  trialEndsAt: Date | null;
  billingCycleStartsAt: Date;
  billingCycleEndsAt: Date;
  planOverride: WorkspacePlan | null;
  planOverrideExpiresAt: Date | null;
}

export interface UsageResolverInput {
  workspaceId: string;
  resourceId?: string;
}

export interface UserWorkspaceCreationAccess {
  allowed: true;
  currentUsage: number;
  projectedUsage: number;
  limit: number | null;
  controllingPlan: WorkspacePlan;
  requiresMultiWorkspaceFeature: boolean;
}

const isDbConnectionError = (error: unknown) => {
  const prismaError = error as { code?: string };
  return prismaError?.code === "P1001" || prismaError?.code === "P1002";
};

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

const getWorkspacePlanRecord = async (workspaceId: string): Promise<WorkspacePlanRecord> => {
  try {
    const workspaceResult = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        deletedAt: null,
      },
      select: {
        id: true,
        createdAt: true,
        deletedAt: true,
        trialStartsAt: true,
        trialEndsAt: true,
        planOverride: true,
        planOverrideExpiresAt: true,
        billingCycleStartsAt: true,
        billingCycleEndsAt: true,
        subscriptions: {
          where: {
            status: SubscriptionStatus.ACTIVE,
          },
          select: {
            plan: true,
          },
          take: 1,
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!workspaceResult) {
      throw new AppError(status.NOT_FOUND, "Workspace not found");
    }

    const subscriptionPlan = workspaceResult.subscriptions[0]?.plan ?? SubscriptionPlan.FREE;

    return {
      id: workspaceResult.id,
      subscriptionPlan,
      createdAt: workspaceResult.createdAt,
      deletedAt: workspaceResult.deletedAt,
      trialStartsAt: workspaceResult.trialStartsAt,
      trialEndsAt: workspaceResult.trialEndsAt,
      planOverride: workspaceResult.planOverride,
      planOverrideExpiresAt: workspaceResult.planOverrideExpiresAt,
      billingCycleStartsAt: workspaceResult.billingCycleStartsAt,
      billingCycleEndsAt: workspaceResult.billingCycleEndsAt,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (isDbConnectionError(error)) {
      throw new AppError(status.SERVICE_UNAVAILABLE, "Database connection failed");
    }
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to resolve workspace plan");
  }
};

const resolveBasePlan = (subscriptionPlan: SubscriptionPlan): WorkspacePlan => {
  const value = String(subscriptionPlan);
  return isKnownWorkspacePlan(value) ? value : DEFAULT_WORKSPACE_PLAN;
};

const resolveOverridePlan = (
  planOverride: SubscriptionPlan | null,
  planOverrideExpiresAt: Date | null
): WorkspacePlan | null => {
  if (!planOverride) {
    return null;
  }

  const overrideValue = String(planOverride);

  if (!isKnownWorkspacePlan(overrideValue)) {
    return null;
  }

  if (planOverrideExpiresAt && new Date() > planOverrideExpiresAt) {
    return null;
  }

  return overrideValue;
};

const getBillingCycleRange = (workspace: WorkspacePlanRecord) => {
  if (workspace.billingCycleStartsAt && workspace.billingCycleEndsAt) {
    return {
      start: workspace.billingCycleStartsAt,
      end: workspace.billingCycleEndsAt,
    };
  }

  return getMonthRange();
};

export const resolveWorkspacePlanContext = async (
  workspaceId: string
): Promise<WorkspacePlanContext> => {
  const workspace = await getWorkspacePlanRecord(workspaceId);

  const basePlan = resolveBasePlan(workspace.subscriptionPlan);
  const overridePlan = resolveOverridePlan(workspace.planOverride, workspace.planOverrideExpiresAt);

  const basePolicy = PLAN_FEATURES[basePlan];

  let effectivePlan: WorkspacePlan = basePlan;
  let isTrialActive = false;

  let trialStartedAt: Date | null = workspace.trialStartsAt;
  let trialEndsAt: Date | null = workspace.trialEndsAt;

  if (overridePlan) {
    effectivePlan = overridePlan;
  } else if (trialStartedAt && trialEndsAt) {
    isTrialActive = new Date() < trialEndsAt;

    if (isTrialActive) {
      const configuredTemporaryPlan = basePolicy.trial.temporaryPlan;
      if (configuredTemporaryPlan) {
        effectivePlan = configuredTemporaryPlan;
      }
    }
  } else {
    const trialPolicy = basePolicy.trial;

    if (trialPolicy.enabled && trialPolicy.temporaryPlan) {
      trialStartedAt = workspace.createdAt;
      trialEndsAt = addDays(workspace.createdAt, trialPolicy.durationDays);
      isTrialActive = new Date() < trialEndsAt;

      if (isTrialActive) {
        effectivePlan = trialPolicy.temporaryPlan;
      }
    }
  }

  const billingCycle = getBillingCycleRange(workspace);

  return {
    workspaceId: workspace.id,
    basePlan,
    effectivePlan,
    isTrialActive,
    trialStartedAt,
    trialEndsAt,
    billingCycleStartsAt: billingCycle.start,
    billingCycleEndsAt: billingCycle.end,
    planOverride: overridePlan,
    planOverrideExpiresAt: workspace.planOverrideExpiresAt,
  };
};

export const getPlanFeatureAccess = async (workspaceId: string, featureKey: PlanFeatureKey) => {
  const planContext = await resolveWorkspacePlanContext(workspaceId);
  const enabled = PLAN_FEATURES[planContext.effectivePlan].flags[featureKey];

  return {
    enabled,
    featureKey,
    ...planContext,
  };
};

export const assertPlanFeatureEnabled = async (workspaceId: string, featureKey: PlanFeatureKey) => {
  const featureAccess = await getPlanFeatureAccess(workspaceId, featureKey);

  if (!featureAccess.enabled) {
    const suffix = featureAccess.isTrialActive
      ? ""
      : ` Upgrade from ${featureAccess.basePlan} to unlock this feature.`;

    throw new AppError(
      status.FORBIDDEN,
      `The feature "${featureKey}" is not available on your current plan.${suffix}`
    );
  }

  return featureAccess;
};

type UsageResolver = (input: UsageResolverInput) => Promise<number>;

const usageResolvers: Record<PlanLimitKey, UsageResolver> = {
  workspaces: async () => {
    throw new AppError(
      status.BAD_REQUEST,
      'Use "assertUserCanCreateWorkspace" for workspace creation limits'
    );
  },

  members: async ({ workspaceId }) =>
    prisma.workspaceMember.count({
      where: {
        workspaceId,
        status: "ACTIVE",
        workspace: { deletedAt: null },
      },
    }),

  projects: async ({ workspaceId }) =>
    prisma.project.count({
      where: {
        workspaceId,
        deletedAt: null,
      },
    }),

  tasks: async ({ workspaceId }) =>
    prisma.task.count({
      where: {
        workspaceId,
        deletedAt: null,
      },
    }),

  taskCommentsPerTask: async ({ resourceId }) => {
    if (!resourceId) {
      throw new AppError(
        status.BAD_REQUEST,
        'A taskId is required as "resourceId" to evaluate comment limits'
      );
    }

    return prisma.taskComment.count({
      where: {
        taskId: resourceId,
      },
    });
  },

  taskAttachmentsPerTask: async ({ resourceId }) => {
    if (!resourceId) {
      throw new AppError(
        status.BAD_REQUEST,
        'A taskId is required as "resourceId" to evaluate attachment limits'
      );
    }

    return prisma.taskAttachment.count({
      where: {
        taskId: resourceId,
      },
    });
  },

  storageMb: async ({ workspaceId }) => {
    const aggregate = await prisma.taskAttachment.aggregate({
      where: {
        workspaceId,
      },
      _sum: {
        fileSize: true,
      },
    });

    const totalBytes = Number(aggregate._sum.fileSize ?? 0);
    return Math.ceil(totalBytes / (1024 * 1024));
  },

  monthlyInvitations: async ({ workspaceId }) => {
    const planContext = await resolveWorkspacePlanContext(workspaceId);

    return prisma.workspaceInvitation.count({
      where: {
        workspaceId,
        createdAt: {
          gte: planContext.billingCycleStartsAt,
          lt: planContext.billingCycleEndsAt,
        },
      },
    });
  },

  monthlyInvoices: async ({ workspaceId }) => {
    const planContext = await resolveWorkspacePlanContext(workspaceId);

    return prisma.invoice.count({
      where: {
        workspaceId,
        createdAt: {
          gte: planContext.billingCycleStartsAt,
          lt: planContext.billingCycleEndsAt,
        },
      },
    });
  },
};

export const getCurrentPlanUsage = async (options: {
  workspaceId: string;
  limitKey: PlanLimitKey;
  resourceId?: string;
  customUsage?: number;
}): Promise<number> => {
  const { workspaceId, limitKey, resourceId, customUsage } = options;

  if (typeof customUsage === "number") {
    return customUsage;
  }

  const resolver = usageResolvers[limitKey];

  if (!resolver) {
    throw new AppError(
      status.BAD_REQUEST,
      `No usage resolver is configured for limit "${limitKey}"`
    );
  }

  try {
    return await resolver({
      workspaceId,
      resourceId,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (isDbConnectionError(error)) {
      throw new AppError(status.SERVICE_UNAVAILABLE, "Database connection failed");
    }
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to evaluate plan usage");
  }
};

export const getPlanLimit = async (workspaceId: string, limitKey: PlanLimitKey) => {
  const planContext = await resolveWorkspacePlanContext(workspaceId);
  const limit = PLAN_FEATURES[planContext.effectivePlan].limits[limitKey];

  return {
    limit,
    limitKey,
    ...planContext,
  };
};

export const assertPlanLimitNotReached = async (options: {
  workspaceId: string;
  limitKey: PlanLimitKey;
  incrementBy?: number;
  resourceId?: string;
  customUsage?: number;
  customMessage?: string;
}) => {
  const {
    workspaceId,
    limitKey,
    incrementBy = 1,
    resourceId,
    customUsage,
    customMessage,
  } = options;

  const [planLimit, currentUsage] = await Promise.all([
    getPlanLimit(workspaceId, limitKey),
    getCurrentPlanUsage({
      workspaceId,
      limitKey,
      resourceId,
      customUsage,
    }),
  ]);

  if (planLimit.limit === null) {
    return {
      allowed: true,
      currentUsage,
      projectedUsage: currentUsage + incrementBy,
      ...planLimit,
    };
  }

  const projectedUsage = currentUsage + incrementBy;

  if (projectedUsage > planLimit.limit) {
    throw new AppError(
      status.FORBIDDEN,
      customMessage ?? `You have reached the "${limitKey}" limit for your current plan.`
    );
  }

  return {
    allowed: true,
    currentUsage,
    projectedUsage,
    ...planLimit,
  };
};

const getUserOwnedWorkspacePlanSummary = async (userId: string) => {
  const ownedWorkspaces = await prisma.workspaceMember.findMany({
    where: {
      userId,
      role: WorkspaceMemberRole.OWNER,
      workspace: {
        deletedAt: null,
      },
    },
    select: {
      workspaceId: true,
    },
  });

  const ownedWorkspaceIds = ownedWorkspaces.map((item) => item.workspaceId);
  const workspaceCount = ownedWorkspaceIds.length;

  if (workspaceCount === 0) {
    return {
      workspaceCount,
      controllingPlan: DEFAULT_WORKSPACE_PLAN,
      hasMultiWorkspaceAccess: false,
    };
  }

  const planContexts = await Promise.all(
    ownedWorkspaceIds.map((workspaceId) => resolveWorkspacePlanContext(workspaceId))
  );

  const controllingPlan = planContexts.reduce<WorkspacePlan>((highest, current) => {
    return getHigherWorkspacePlan(highest, current.effectivePlan);
  }, DEFAULT_WORKSPACE_PLAN);

  const hasMultiWorkspaceAccess = planContexts.some(
    (context) => PLAN_FEATURES[context.effectivePlan].flags["workspace.multiWorkspace"]
  );

  return {
    workspaceCount,
    controllingPlan,
    hasMultiWorkspaceAccess,
  };
};

export const assertUserCanCreateWorkspace = async (
  userId: string
): Promise<UserWorkspaceCreationAccess> => {
  try {
    const { workspaceCount, controllingPlan, hasMultiWorkspaceAccess } =
      await getUserOwnedWorkspacePlanSummary(userId);

    if (workspaceCount === 0) {
      const limit = PLAN_FEATURES[DEFAULT_WORKSPACE_PLAN].limits.workspaces;

      return {
        allowed: true,
        currentUsage: 0,
        projectedUsage: 1,
        limit,
        controllingPlan: DEFAULT_WORKSPACE_PLAN,
        requiresMultiWorkspaceFeature: false,
      };
    }

    if (!hasMultiWorkspaceAccess) {
      throw new AppError(
        status.FORBIDDEN,
        'Your current plan does not allow creating multiple workspaces. Upgrade to unlock "workspace.multiWorkspace".'
      );
    }

    const limit = PLAN_FEATURES[controllingPlan].limits.workspaces;
    const projectedUsage = workspaceCount + 1;

    if (limit !== null && projectedUsage > limit) {
      throw new AppError(
        status.FORBIDDEN,
        `You have reached the "workspaces" limit for your current plan.`
      );
    }

    return {
      allowed: true,
      currentUsage: workspaceCount,
      projectedUsage,
      limit,
      controllingPlan,
      requiresMultiWorkspaceFeature: true,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (isDbConnectionError(error)) {
      throw new AppError(status.SERVICE_UNAVAILABLE, "Database connection failed");
    }
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to evaluate workspace creation limit");
  }
};

export const getWorkspaceRateLimitPolicy = async (
  workspaceId: string,
  actionKey: RateLimitActionKey
) => {
  const planContext = await resolveWorkspacePlanContext(workspaceId);
  const policy = PLAN_FEATURES[planContext.effectivePlan].rateLimits[actionKey];

  return {
    actionKey,
    policy,
    ...planContext,
  };
};

export const isFeatureEnabledForPlan = (plan: WorkspacePlan, featureKey: PlanFeatureKey) => {
  return PLAN_FEATURES[plan].flags[featureKey];
};

export const getLimitForPlan = (plan: WorkspacePlan, limitKey: PlanLimitKey) => {
  return PLAN_FEATURES[plan].limits[limitKey];
};

export const getRateLimitForPlan = (plan: WorkspacePlan, actionKey: RateLimitActionKey) => {
  return PLAN_FEATURES[plan].rateLimits[actionKey];
};
