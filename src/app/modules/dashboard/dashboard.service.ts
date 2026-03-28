import {
  addDays,
  addMonths,
  addWeeks,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
} from "date-fns";
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
  IPlatformDashboardActivityQuery,
  IPlatformDashboardActivityResponse,
  IPlatformDashboardMetricsQuery,
  IPlatformDashboardMetricsResponse,
  IPlatformDashboardOverviewQuery,
  IPlatformDashboardOverviewResponse,
  IWorkspaceDashboardActivityQuery,
  IWorkspaceDashboardActivityResponse,
  IWorkspaceDashboardInvoiceSummary,
  IWorkspaceDashboardMetricsQuery,
  IWorkspaceDashboardMetricsResponse,
  IWorkspaceDashboardOverviewQuery,
  IWorkspaceDashboardOverviewResponse,
} from "./dashboard.interface";

type AggregationUnit = "day" | "week" | "month";

interface AggregationConfig {
  unit: AggregationUnit;
  startDate: Date;
  endDate: Date;
  numBuckets: number;
}

const getAggregationConfig = (period: string): AggregationConfig => {
  const now = new Date();
  const endDate = endOfDay(now);

  switch (period) {
    case "last_7_days":
      return {
        unit: "day",
        startDate: startOfDay(subDays(now, 6)),
        endDate,
        numBuckets: 7,
      };
    case "last_3_months":
      return {
        unit: "week",
        startDate: startOfWeek(subMonths(now, 3)),
        endDate,
        numBuckets: 13,
      };
    case "last_12_months":
      return {
        unit: "month",
        startDate: startOfMonth(subMonths(now, 11)),
        endDate,
        numBuckets: 12,
      };
    case "last_30_days":
    default:
      return {
        unit: "day",
        startDate: startOfDay(subDays(now, 29)),
        endDate,
        numBuckets: 30,
      };
  }
};

const formatBucketLabel = (start: Date, end: Date, unit: AggregationUnit): string => {
  if (unit === "day") return format(start, "MMM d");
  if (unit === "month") return format(start, "MMM");

  const startMonth = format(start, "MMM");
  const endMonth = format(end, "MMM");
  if (startMonth === endMonth) {
    return `${startMonth} ${format(start, "d")}–${format(end, "d")}`;
  }
  return `${format(start, "MMM d")}–${format(end, "MMM d")}`;
};

const formatBucketKey = (date: Date, unit: AggregationUnit): string => {
  if (unit === "month") return format(date, "yyyy-MM");
  if (unit === "day") return format(date, "yyyy-MM-dd");
  return format(startOfWeek(date), "yyyy-MM-dd");
};

const generateTimeSeriesBuckets = <T extends Record<string, any>>(
  config: AggregationConfig,
  defaultValues: T
) => {
  const buckets = new Map<
    string,
    T & { key: string; bucketStart: string; bucketEnd: string; label: string }
  >();
  let current = new Date(config.startDate);

  for (let i = 0; i < config.numBuckets; i++) {
    let bStart: Date;
    let bEnd: Date;

    if (config.unit === "day") {
      bStart = startOfDay(current);
      bEnd = endOfDay(current);
      current = addDays(current, 1);
    } else if (config.unit === "week") {
      bStart = startOfWeek(current);
      bEnd = endOfWeek(current);
      current = addWeeks(current, 1);
    } else {
      bStart = startOfMonth(current);
      bEnd = endOfMonth(current);
      current = addMonths(current, 1);
    }

    const key = formatBucketKey(bStart, config.unit);
    buckets.set(key, {
      ...defaultValues,
      key,
      bucketStart: bStart.toISOString(),
      bucketEnd: bEnd.toISOString(),
      label: formatBucketLabel(bStart, bEnd, config.unit),
    });
  }

  return buckets;
};

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
      currency: true,
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
  const isSuperAdmin = req.user?.systemRole === "SUPER_ADMIN";

  if (!req.user || (!isSuperAdmin && (!req.workspaceId || !req.workspaceRole))) {
    throw new AppError(
      status.UNAUTHORIZED,
      "Dashboard access requires authentication and workspace context"
    );
  }

  const workspaceId = req.workspaceId;
  const userId = req.user!.id;
  const role = req.workspaceRole ?? WorkspaceMemberRole.OWNER;

  if (!workspaceId) {
    throw new AppError(status.BAD_REQUEST, "No active workspace selected");
  }
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
    subscription: isMember
      ? null
      : {
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
  const isSuperAdmin = req.user?.systemRole === "SUPER_ADMIN";

  if (!req.user || (!isSuperAdmin && (!req.workspaceId || !req.workspaceRole))) {
    throw new AppError(
      status.UNAUTHORIZED,
      "Dashboard activity requires authentication and workspace context"
    );
  }

  const workspaceId = req.workspaceId;
  if (!workspaceId) {
    throw new AppError(status.BAD_REQUEST, "No active workspace selected");
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
  const isSuperAdmin = req.user?.systemRole === "SUPER_ADMIN";

  if (!req.user || (!isSuperAdmin && (!req.workspaceId || !req.workspaceRole))) {
    throw new AppError(
      status.UNAUTHORIZED,
      "Dashboard metrics requires authentication and workspace context"
    );
  }

  const workspaceId = req.workspaceId;
  if (!workspaceId) {
    throw new AppError(status.BAD_REQUEST, "No active workspace selected");
  }

  const config = getAggregationConfig(query.period || "last_30_days");
  const { startDate, endDate, unit } = config;

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

  const projectsMap = generateTimeSeriesBuckets(config, { created: 0, completed: 0 });
  const tasksMap = generateTimeSeriesBuckets(config, { created: 0, completed: 0 });
  const revenueMap = generateTimeSeriesBuckets(config, { paidAmount: 0, amount: 0, currency: "" });

  createdProjects.forEach((p) => {
    const key = formatBucketKey(p.createdAt, unit);
    const existing = projectsMap.get(key);
    if (existing) existing.created += 1;
  });
  completedProjects.forEach((p) => {
    const key = formatBucketKey(p.updatedAt, unit);
    const existing = projectsMap.get(key);
    if (existing) existing.completed += 1;
  });

  createdTasks.forEach((t) => {
    const key = formatBucketKey(t.createdAt, unit);
    const existing = tasksMap.get(key);
    if (existing) existing.created += 1;
  });
  completedTasks.forEach((t) => {
    const key = formatBucketKey(t.updatedAt, unit);
    const existing = tasksMap.get(key);
    if (existing) existing.completed += 1;
  });

  const workspace = await getWorkspaceOrThrow(workspaceId);
  const primaryCurrency = workspace.currency || "USD";

  paidInvoices.forEach((i) => {
    if (i.currency !== primaryCurrency) return;
    const key = formatBucketKey(i.updatedAt, unit);
    const existing = revenueMap.get(key);
    if (existing) {
      existing.paidAmount += Number(i.amount);
      existing.amount = existing.paidAmount;
      existing.currency = i.currency;
    }
  });

  return {
    scope: req.workspaceRole === WorkspaceMemberRole.MEMBER ? "member" : "workspace",
    revenue:
      req.workspaceRole === WorkspaceMemberRole.MEMBER ? [] : Array.from(revenueMap.values()),
    projects: Array.from(projectsMap.values()),
    tasks: Array.from(tasksMap.values()),
  };
};

const getPlatformOverview = async (
  req: Request,
  _query: IPlatformDashboardOverviewQuery
): Promise<IPlatformDashboardOverviewResponse> => {
  const thisMonthStart = startOfMonth(new Date());

  const [
    totalWorkspaces,
    activeWorkspaces,
    newWorkspacesThisMonth,
    totalUsers,
    activeUsers,
    newUsersThisMonth,
    paidSubscriptions,
    trialSubscriptions,
    totalInvoices,
    paidInvoicesCount,
    overdueInvoices,
    totalPaidAmountRows,
  ] = await Promise.all([
    prisma.workspace.count({ where: { deletedAt: null } }),
    prisma.workspace.count({
      where: {
        deletedAt: null,
        subscriptions: { some: { status: "ACTIVE" } },
      },
    }),
    prisma.workspace.count({
      where: { deletedAt: null, createdAt: { gte: thisMonthStart } },
    }),
    prisma.user.count({ where: { isDeleted: false } }),
    prisma.user.count({ where: { isDeleted: false, isActive: true } }),
    prisma.user.count({
      where: { isDeleted: false, createdAt: { gte: thisMonthStart } },
    }),
    prisma.subscription.count({ where: { status: "ACTIVE" } }),
    prisma.workspace.count({ where: { trialEndsAt: { gt: new Date() } } }),
    prisma.invoice.count({ where: { deletedAt: null } }),
    prisma.invoice.count({ where: { deletedAt: null, status: InvoiceStatus.PAID } }),
    prisma.invoice.count({ where: { deletedAt: null, status: InvoiceStatus.OVERDUE } }),
    prisma.invoice.aggregate({
      where: { deletedAt: null, status: InvoiceStatus.PAID },
      _sum: { amount: true },
    }),
  ]);

  return {
    scope: "platform",
    workspaces: {
      total: totalWorkspaces,
      active: activeWorkspaces,
      newThisMonth: newWorkspacesThisMonth,
    },
    users: {
      total: totalUsers,
      active: activeUsers,
      newThisMonth: newUsersThisMonth,
    },
    subscriptions: {
      total: paidSubscriptions + trialSubscriptions,
      paid: paidSubscriptions,
      trial: trialSubscriptions,
    },
    invoices: {
      total: totalInvoices,
      paid: paidInvoicesCount,
      overdue: overdueInvoices,
      totalPaidAmount: Number(totalPaidAmountRows._sum.amount || 0),
    },
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
  const config = getAggregationConfig(query.period || "last_30_days");
  const { startDate, endDate, unit } = config;

  const [createdWorkspaces, createdUsers, createdSubscriptions, createdInvoices, paidInvoices] =
    await Promise.all([
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

  const workspacesMap = generateTimeSeriesBuckets(config, { created: 0, completed: 0 });
  const usersMap = generateTimeSeriesBuckets(config, { created: 0, completed: 0 });
  const subscriptionsMap = generateTimeSeriesBuckets(config, { trials: 0, paid: 0, canceled: 0 });
  const invoicesMap = generateTimeSeriesBuckets(config, { created: 0, paid: 0 });
  const revenueMap = generateTimeSeriesBuckets(config, {
    paidAmount: 0,
    amount: 0,
    currency: "USD",
  });

  createdWorkspaces.forEach((w) => {
    const key = formatBucketKey(w.createdAt, unit);
    const existing = workspacesMap.get(key);
    if (existing) existing.created += 1;
  });

  createdUsers.forEach((u) => {
    const key = formatBucketKey(u.createdAt, unit);
    const existing = usersMap.get(key);
    if (existing) existing.created += 1;
  });

  createdSubscriptions.forEach((s) => {
    const key = formatBucketKey(s.createdAt, unit);
    const existing = subscriptionsMap.get(key);
    if (existing) {
      if (s.status === "ACTIVE") existing.paid += 1;
      else if (s.status === "CANCELED" || s.status === "PAST_DUE") existing.canceled += 1;
    }
  });

  createdInvoices.forEach((i) => {
    const key = formatBucketKey(i.createdAt, unit);
    const existing = invoicesMap.get(key);
    if (existing) {
      existing.created += 1;
      if (i.status === InvoiceStatus.PAID) existing.paid += 1;
    }
  });

  paidInvoices.forEach((i) => {
    const key = formatBucketKey(i.updatedAt, unit);
    const existing = revenueMap.get(key);
    if (existing) {
      existing.paidAmount += Number(i.amount);
      existing.amount = existing.paidAmount;
      existing.currency = i.currency;
    }
  });

  return {
    scope: "platform",
    revenue: Array.from(revenueMap.values()),
    workspaces: Array.from(workspacesMap.values()),
    users: Array.from(usersMap.values()),
    subscriptions: Array.from(subscriptionsMap.values()),
    invoices: Array.from(invoicesMap.values()),
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
