import { Request } from "express";
import status from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import { InvoiceStatus, ProjectStatus, TaskStatus } from "../../../generated/prisma/enums";
import { WorkspaceMemberRole } from "../../constants/role";
import { SubscriptionPlan } from "../../constants/subscription";
import AppError from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import { resolveWorkspacePlanContext } from "../../utils/checkPlanLimit";
import { formatMoney } from "../invoice/invoice.utils";
import {
  IDashboardActivityItem,
  IDashboardActivityQuery,
  IDashboardActivityResponse,
  IDashboardInvoiceSummary,
  IDashboardOverviewQuery,
  IDashboardOverviewResponse,
} from "./dashboard.interface";

const buildTodayRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start, end };
};

const sanitizeActivityMetadata = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const sensitiveKeyPattern =
    /(email|token|secret|password|authorization|cookie|api.?key|fileUrl|url)/i;

  const sanitizeValue = (input: unknown): unknown => {
    if (input === null) return null;

    if (Array.isArray(input)) {
      return input.slice(0, 20).map(sanitizeValue);
    }

    if (typeof input === "object") {
      const output: Record<string, unknown> = {};

      for (const [key, val] of Object.entries(input as Record<string, unknown>)) {
        if (sensitiveKeyPattern.test(key)) {
          output[key] = "[REDACTED]";
          continue;
        }

        output[key] = sanitizeValue(val);
      }

      return output;
    }

    if (typeof input === "string" && input.length > 500) {
      return `${input.slice(0, 500)}…`;
    }

    return input;
  };

  return sanitizeValue(value) as Record<string, unknown>;
};

const getWorkspaceOrThrow = async (workspaceId: string) => {
  const workspace = await prisma.workspace.findFirst({
    where: {
      id: workspaceId,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      slug: true,
    },
  });

  if (!workspace) {
    throw new AppError(status.NOT_FOUND, "Workspace not found");
  }

  return workspace;
};

const mapGroupedCount = <T extends string>(
  rows: Array<{ status: T; _count: { _all: number } }>
) => {
  return rows.reduce<Record<string, number>>((acc, row) => {
    acc[String(row.status)] = row._count._all;
    return acc;
  }, {});
};

const buildVisibleProjectWhere = (req: Request): Prisma.ProjectWhereInput => {
  const workspaceId = req.workspaceId!;
  const isMember = req.workspaceRole === WorkspaceMemberRole.MEMBER;

  return {
    workspaceId,
    deletedAt: null,
    workspace: {
      deletedAt: null,
    },
    ...(isMember
      ? {
          members: {
            some: {
              userId: req.user!.id,
            },
          },
        }
      : {}),
  };
};

const buildVisibleTaskWhere = (req: Request): Prisma.TaskWhereInput => {
  const workspaceId = req.workspaceId!;
  const isMember = req.workspaceRole === WorkspaceMemberRole.MEMBER;

  return {
    workspaceId,
    deletedAt: null,
    project: {
      deletedAt: null,
      workspaceId,
    },
    ...(isMember
      ? {
          OR: [{ assignedToUserId: req.user!.id }, { createdByUserId: req.user!.id }],
        }
      : {}),
  };
};

const buildInvoiceWhereForRole = (req: Request): Prisma.InvoiceWhereInput | null => {
  if (req.workspaceRole === WorkspaceMemberRole.MEMBER) {
    return null;
  }

  return {
    workspaceId: req.workspaceId!,
    deletedAt: null,
    workspace: {
      deletedAt: null,
    },
  };
};

const getInvoiceSummary = async (
  where: Prisma.InvoiceWhereInput
): Promise<IDashboardInvoiceSummary> => {
  const [total, groupedStatuses, collectedRows, outstandingRows] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.groupBy({
      by: ["status"],
      where,
      _count: {
        _all: true,
      },
    }),
    prisma.invoice.groupBy({
      by: ["currency"],
      where: {
        ...where,
        status: InvoiceStatus.PAID,
      },
      _sum: {
        amount: true,
      },
    }),
    prisma.invoice.groupBy({
      by: ["currency"],
      where: {
        ...where,
        status: {
          in: [InvoiceStatus.PENDING, InvoiceStatus.OVERDUE],
        },
      },
      _sum: {
        amount: true,
      },
    }),
  ]);

  const statusMap = groupedStatuses.reduce<Record<string, number>>((acc, row) => {
    acc[String(row.status)] = row._count._all;
    return acc;
  }, {});

  const currencyMap = new Map<
    string,
    {
      currency: string;
      collectedAmount: string;
      outstandingAmount: string;
    }
  >();

  for (const row of collectedRows) {
    currencyMap.set(row.currency, {
      currency: row.currency,
      collectedAmount: formatMoney(row._sum.amount ?? 0),
      outstandingAmount: formatMoney(0),
    });
  }

  for (const row of outstandingRows) {
    const existing = currencyMap.get(row.currency);

    if (existing) {
      existing.outstandingAmount = formatMoney(row._sum.amount ?? 0);
    } else {
      currencyMap.set(row.currency, {
        currency: row.currency,
        collectedAmount: formatMoney(0),
        outstandingAmount: formatMoney(row._sum.amount ?? 0),
      });
    }
  }

  return {
    total,
    pending: statusMap[InvoiceStatus.PENDING] ?? 0,
    paid: statusMap[InvoiceStatus.PAID] ?? 0,
    overdue: statusMap[InvoiceStatus.OVERDUE] ?? 0,
    canceled: statusMap[InvoiceStatus.CANCELED] ?? 0,
    totalsByCurrency: Array.from(currencyMap.values()).sort((a, b) =>
      a.currency.localeCompare(b.currency)
    ),
  };
};

const getOverview = async (
  req: Request,
  _query: IDashboardOverviewQuery
): Promise<IDashboardOverviewResponse> => {
  if (!req.user || !req.workspaceId || !req.workspaceRole) {
    throw new AppError(status.UNAUTHORIZED, "Dashboard access requires authentication");
  }

  const workspaceId = req.workspaceId;
  const userId = req.user.id;
  const role = req.workspaceRole;
  const isMember = role === WorkspaceMemberRole.MEMBER;

  const workspace = await getWorkspaceOrThrow(workspaceId);
  const planContext = await resolveWorkspacePlanContext(workspaceId);

  const projectWhere = buildVisibleProjectWhere(req);
  const taskWhere = buildVisibleTaskWhere(req);
  const invoiceWhere = buildInvoiceWhereForRole(req);
  const { start: todayStart, end: todayEnd } = buildTodayRange();

  const [
    projectTotal,
    groupedProjects,
    taskTotal,
    groupedTasks,
    overdueTasks,
    dueTodayTasks,
    assignedToMeTasks,
    createdByMeTasks,
    invoiceSummary,
  ] = await Promise.all([
    prisma.project.count({ where: projectWhere }),
    prisma.project.groupBy({
      by: ["status"],
      where: projectWhere,
      _count: {
        _all: true,
      },
    }),
    prisma.task.count({ where: taskWhere }),
    prisma.task.groupBy({
      by: ["status"],
      where: taskWhere,
      _count: {
        _all: true,
      },
    }),
    prisma.task.count({
      where: {
        ...taskWhere,
        dueDate: {
          lt: new Date(),
        },
        status: {
          not: TaskStatus.DONE,
        },
      },
    }),
    prisma.task.count({
      where: {
        ...taskWhere,
        dueDate: {
          gte: todayStart,
          lt: todayEnd,
        },
      },
    }),
    prisma.task.count({
      where: {
        workspaceId,
        deletedAt: null,
        project: {
          deletedAt: null,
          workspaceId,
        },
        assignedToUserId: userId,
      },
    }),
    prisma.task.count({
      where: {
        workspaceId,
        deletedAt: null,
        project: {
          deletedAt: null,
          workspaceId,
        },
        createdByUserId: userId,
      },
    }),
    invoiceWhere ? getInvoiceSummary(invoiceWhere) : Promise.resolve(null),
  ]);

  const projectStatusMap = mapGroupedCount<ProjectStatus>(groupedProjects);
  const taskStatusMap = mapGroupedCount<TaskStatus>(groupedTasks);

  return {
    scope: isMember ? "member" : "workspace",
    workspace: {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      role,
    },
    subscription: {
      basePlan: planContext.basePlan as SubscriptionPlan,
      effectivePlan: planContext.effectivePlan as SubscriptionPlan,
      isTrialActive: planContext.isTrialActive,
      trialEndsAt: planContext.trialEndsAt,
      billingCycleStartsAt: planContext.billingCycleStartsAt,
      billingCycleEndsAt: planContext.billingCycleEndsAt,
    },
    projects: {
      total: projectTotal,
      active: projectStatusMap[ProjectStatus.ACTIVE] ?? 0,
      completed: projectStatusMap[ProjectStatus.COMPLETED] ?? 0,
      onHold: projectStatusMap[ProjectStatus.ON_HOLD] ?? 0,
      archived: projectStatusMap[ProjectStatus.ARCHIVED] ?? 0,
    },
    tasks: {
      total: taskTotal,
      todo: taskStatusMap[TaskStatus.TODO] ?? 0,
      inProgress: taskStatusMap[TaskStatus.IN_PROGRESS] ?? 0,
      review: taskStatusMap[TaskStatus.REVIEW] ?? 0,
      done: taskStatusMap[TaskStatus.DONE] ?? 0,
      overdue: overdueTasks,
      dueToday: dueTodayTasks,
      assignedToMe: assignedToMeTasks,
      createdByMe: createdByMeTasks,
    },
    invoices: invoiceSummary,
  };
};

const getActivity = async (
  req: Request,
  query: IDashboardActivityQuery
): Promise<IDashboardActivityResponse> => {
  if (!req.user || !req.workspaceId || !req.workspaceRole) {
    throw new AppError(status.UNAUTHORIZED, "Dashboard activity requires authentication");
  }

  const isMember = req.workspaceRole === WorkspaceMemberRole.MEMBER;
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 50);
  const skip = (page - 1) * limit;

  const where: Prisma.ActivityLogWhereInput = {
    workspaceId: req.workspaceId,
    ...(isMember ? { userId: req.user.id } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        metadata: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    }),
    prisma.activityLog.count({ where }),
  ]);

  const data: IDashboardActivityItem[] = rows.map((row) => ({
    id: row.id,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId ?? null,
    metadata: sanitizeActivityMetadata(row.metadata),
    createdAt: row.createdAt,
    actor: {
      id: row.user.id,
      name: row.user.name,
      email: row.user.email,
      image: row.user.image,
    },
  }));

  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

export const DashboardService = {
  getOverview,
  getActivity,
};
