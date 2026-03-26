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
  IWorkspaceDashboardActivityQuery,
  IWorkspaceDashboardActivityResponse,
  IWorkspaceDashboardInvoiceSummary,
  IWorkspaceDashboardMetricsQuery,
  IWorkspaceDashboardMetricsResponse,
  IWorkspaceDashboardOverviewQuery,
  IWorkspaceDashboardOverviewResponse,
  IPlatformDashboardActivityQuery,
  IPlatformDashboardActivityResponse,
  IPlatformDashboardMetricsQuery,
  IPlatformDashboardMetricsResponse,
  IPlatformDashboardOverviewQuery,
  IPlatformDashboardOverviewResponse,
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
): Promise<IWorkspaceDashboardInvoiceSummary> => {
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
  _query: IWorkspaceDashboardOverviewQuery
): Promise<IWorkspaceDashboardOverviewResponse> => {
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
    subscription: isMember ? null : {
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
    invoices: isMember ? null : invoiceSummary,
  };
};

const getActivity = async (
  req: Request,
  query: IWorkspaceDashboardActivityQuery
): Promise<IWorkspaceDashboardActivityResponse> => {
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

const getMetrics = async (
  req: Request,
  query: IWorkspaceDashboardMetricsQuery
): Promise<IWorkspaceDashboardMetricsResponse> => {
  if (!req.user || !req.workspaceId || !req.workspaceRole) {
    throw new AppError(status.UNAUTHORIZED, "Dashboard metrics requires authentication");
  }

  let days = 30;
  switch (query.period) {
    case "last_7_days":
      days = 7;
      break;
    case "last_3_months":
      days = 90;
      break;
    case "last_12_months":
      days = 365;
      break;
    case "last_30_days":
    default:
      days = 30;
      break;
  }

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const formatKey = (d: Date) => {
    if (days > 90) return d.toISOString().substring(0, 7);
    return d.toISOString().split("T")[0];
  };

  const projectWhere = buildVisibleProjectWhere(req);
  const taskWhere = buildVisibleTaskWhere(req);
  const invoiceWhere = buildInvoiceWhereForRole(req);

  const [createdProjects, completedProjects, createdTasks, completedTasks, paidInvoices] =
    await Promise.all([
      prisma.project.findMany({
        where: { ...projectWhere, createdAt: { gte: startDate, lte: endDate } },
        select: { createdAt: true },
      }),
      prisma.project.findMany({
        where: {
          ...projectWhere,
          status: ProjectStatus.COMPLETED,
          updatedAt: { gte: startDate, lte: endDate },
        },
        select: { updatedAt: true },
      }),
      prisma.task.findMany({
        where: { ...taskWhere, createdAt: { gte: startDate, lte: endDate } },
        select: { createdAt: true },
      }),
      prisma.task.findMany({
        where: {
          ...taskWhere,
          status: TaskStatus.DONE,
          updatedAt: { gte: startDate, lte: endDate },
        },
        select: { updatedAt: true },
      }),
      invoiceWhere
        ? prisma.invoice.findMany({
            where: {
              ...invoiceWhere,
              status: InvoiceStatus.PAID,
              updatedAt: { gte: startDate, lte: endDate },
            },
            select: { updatedAt: true, amount: true, currency: true },
          })
        : Promise.resolve([]),
    ]);

  const projectsMap = new Map<string, { date: string; created: number; completed: number }>();
  const tasksMap = new Map<string, { date: string; created: number; completed: number }>();
  const revenueMap = new Map<string, { date: string; amount: number; currency: string }>();

  // Fill project created
  createdProjects.forEach((p) => {
    const key = formatKey(p.createdAt);
    const existing = projectsMap.get(key) || { date: key, created: 0, completed: 0 };
    existing.created += 1;
    projectsMap.set(key, existing);
  });
  // Fill project completed
  completedProjects.forEach((p) => {
    const key = formatKey(p.updatedAt);
    const existing = projectsMap.get(key) || { date: key, created: 0, completed: 0 };
    existing.completed += 1;
    projectsMap.set(key, existing);
  });

  // Fill task created
  createdTasks.forEach((t) => {
    const key = formatKey(t.createdAt);
    const existing = tasksMap.get(key) || { date: key, created: 0, completed: 0 };
    existing.created += 1;
    tasksMap.set(key, existing);
  });
  // Fill task completed
  completedTasks.forEach((t) => {
    const key = formatKey(t.updatedAt);
    const existing = tasksMap.get(key) || { date: key, created: 0, completed: 0 };
    existing.completed += 1;
    tasksMap.set(key, existing);
  });

  // Fill revenue
  paidInvoices.forEach((i) => {
    const key = formatKey(i.updatedAt) + "_" + i.currency;
    const existing = revenueMap.get(key) || {
      date: formatKey(i.updatedAt),
      amount: 0,
      currency: i.currency,
    };
    existing.amount += Number(i.amount);
    revenueMap.set(key, existing);
  });

  return {
    scope: req.workspaceRole === WorkspaceMemberRole.MEMBER ? "member" : "workspace",
    revenue: req.workspaceRole === WorkspaceMemberRole.MEMBER ? [] : Array.from(revenueMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
    projects: Array.from(projectsMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
    tasks: Array.from(tasksMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
  };
};

const getPlatformOverview = async (
  req: Request,
  _query: IPlatformDashboardOverviewQuery
): Promise<IPlatformDashboardOverviewResponse> => {
  const [
    totalWorkspaces,
    activeWorkspaces,
    totalUsers,
    activeUsers,
    paidSubscriptions,
    trialSubscriptions,
    totalInvoices,
    overdueInvoices,
  ] = await Promise.all([
    prisma.workspace.count({ where: { deletedAt: null } }),
    prisma.workspace.count({
      where: {
        deletedAt: null,
        subscriptions: { some: { status: "ACTIVE" } },
      },
    }),
    prisma.user.count({ where: { isDeleted: false } }),
    prisma.user.count({ where: { isDeleted: false, isActive: true } }),
    prisma.subscription.count({ where: { status: "ACTIVE" } }),
    prisma.workspace.count({ where: { trialEndsAt: { gt: new Date() } } }),
    prisma.invoice.count({ where: { deletedAt: null } }),
    prisma.invoice.count({ where: { deletedAt: null, status: InvoiceStatus.OVERDUE } }),
  ]);

  return {
    scope: "platform",
    workspaces: { total: totalWorkspaces, active: activeWorkspaces },
    users: { total: totalUsers, active: activeUsers },
    subscriptions: { paid: paidSubscriptions, trial: trialSubscriptions },
    invoices: { total: totalInvoices, overdue: overdueInvoices },
  };
};

const getPlatformActivity = async (
  req: Request,
  query: IPlatformDashboardActivityQuery
): Promise<IPlatformDashboardActivityResponse> => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 50);
  const skip = (page - 1) * limit;

  const [rows, total] = await Promise.all([
    prisma.activityLog.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        metadata: true,
        createdAt: true,
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    }),
    prisma.activityLog.count(),
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

const getPlatformMetrics = async (
  req: Request,
  query: IPlatformDashboardMetricsQuery
): Promise<IPlatformDashboardMetricsResponse> => {
  let days = 30;
  let aggregation: "day" | "week" | "month" = "day";

  switch (query.period) {
    case "last_7_days":
      days = 7;
      aggregation = "day";
      break;
    case "last_30_days":
      days = 30;
      aggregation = "week";
      break;
    case "last_3_months":
      days = 90;
      aggregation = "month";
      break;
    case "last_12_months":
      days = 365;
      aggregation = "month";
      break;
  }

  const endDate = new Date();
  const startDate = new Date();
  
  if (aggregation === "month") {
    startDate.setMonth(startDate.getMonth() - (query.period === "last_12_months" ? 11 : 2));
    startDate.setDate(1);
  } else if (aggregation === "week") {
    startDate.setDate(startDate.getDate() - 28);
  } else {
    startDate.setDate(startDate.getDate() - 6);
  }
  startDate.setHours(0, 0, 0, 0);

  const formatKey = (d: Date) => {
    if (aggregation === "month") return d.toISOString().substring(0, 7);
    if (aggregation === "week") {
      const diffTime = Math.max(0, d.getTime() - startDate.getTime());
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      return `week_${Math.floor(diffDays / 7)}`;
    }
    return d.toISOString().split("T")[0];
  };

  const formatDateLabel = (d: Date) => {
    if (aggregation === "month") {
      return d.toLocaleDateString("en-US", { month: "short" });
    }
    if (aggregation === "week") {
      const diffTime = Math.max(0, d.getTime() - startDate.getTime());
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const weekNum = Math.floor(diffDays / 7) + 1;
      return `Week ${weekNum}`;
    }
    return d.toLocaleDateString("en-US", { weekday: "short" });
  };

  const [
    createdWorkspaces,
    createdUsers,
    createdSubscriptions,
    createdInvoices,
    paidInvoices,
  ] = await Promise.all([
    prisma.workspace.findMany({
      where: { createdAt: { gte: startDate, lte: endDate } },
      select: { createdAt: true },
    }),
    prisma.user.findMany({
      where: { createdAt: { gte: startDate, lte: endDate } },
      select: { createdAt: true },
    }),
    prisma.subscription.findMany({
      where: { createdAt: { gte: startDate, lte: endDate } },
      select: { createdAt: true, status: true },
    }),
    prisma.invoice.findMany({
      where: { createdAt: { gte: startDate, lte: endDate } },
      select: { createdAt: true, status: true },
    }),
    prisma.invoice.findMany({
      where: {
        status: InvoiceStatus.PAID,
        updatedAt: { gte: startDate, lte: endDate },
      },
      select: { updatedAt: true, amount: true, currency: true },
    }),
  ]);



  const workspacesMap = new Map<string, { date: string; created: number; completed: number }>();
  const usersMap = new Map<string, { date: string; created: number; completed: number }>();
  const subscriptionsMap = new Map<string, { date: string; trials: number; paid: number; canceled: number }>();
  const invoicesMap = new Map<string, { date: string; created: number; paid: number }>();
  const revenueMap = new Map<string, { date: string; amount: number; currency: string }>();

  createdWorkspaces.forEach((w) => {
    const key = formatKey(w.createdAt);
    const existing = workspacesMap.get(key) || { date: key, label: formatDateLabel(w.createdAt), created: 0, completed: 0 };
    existing.created += 1;
    workspacesMap.set(key, existing);
  });

  createdUsers.forEach((u) => {
    const key = formatKey(u.createdAt);
    const existing = usersMap.get(key) || { date: key, label: formatDateLabel(u.createdAt), created: 0, completed: 0 };
    existing.created += 1;
    usersMap.set(key, existing);
  });

  createdSubscriptions.forEach((s) => {
    const key = formatKey(s.createdAt);
    const existing = subscriptionsMap.get(key) || { date: key, label: formatDateLabel(s.createdAt), trials: 0, paid: 0, canceled: 0 };
    if (s.status === "ACTIVE") existing.paid += 1;
    else if (s.status === "CANCELED" || s.status === "PAST_DUE") existing.canceled += 1;
    subscriptionsMap.set(key, existing);
  });

  createdInvoices.forEach((i) => {
    const key = formatKey(i.createdAt);
    const existing = invoicesMap.get(key) || { date: key, label: formatDateLabel(i.createdAt), created: 0, paid: 0 };
    existing.created += 1;
    if (i.status === InvoiceStatus.PAID) existing.paid += 1;
    invoicesMap.set(key, existing);
  });

  paidInvoices.forEach((i) => {
    const key = formatKey(i.updatedAt) + "_" + i.currency;
    const existing = revenueMap.get(key) || { date: formatKey(i.updatedAt), label: formatDateLabel(i.updatedAt), amount: 0, currency: i.currency };
    existing.amount += Number(i.amount);
    revenueMap.set(key, existing);
  });

  return {
    scope: "platform",
    revenue: Array.from(revenueMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
    workspaces: Array.from(workspacesMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
    users: Array.from(usersMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
    subscriptions: Array.from(subscriptionsMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
    invoices: Array.from(invoicesMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
  };
};

export const DashboardService = {
  getOverview,
  getActivity,
  getMetrics,
  getPlatformOverview,
  getPlatformActivity,
  getPlatformMetrics,
};
