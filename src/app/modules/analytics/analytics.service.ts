import { Request } from "express";
import status from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import { InvoiceStatus, ProjectStatus, TaskStatus } from "../../../generated/prisma/enums";
import { WorkspaceMemberRole } from "../../constants/role";
import AppError from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import { formatMoney } from "../invoice/invoice.utils";
import {
  IAnalyticsProjectsQuery,
  IAnalyticsRevenueQuery,
  IProjectsAnalyticsResponse,
  IRevenueAnalyticsResponse,
  IRevenueMonthlySeriesItem,
  IRevenueTotalsByCurrency,
  ITopProjectAnalyticsItem,
} from "./analytics.interface";

const ensureAdminScope = (req: Request) => {
  if (!req.user || !req.workspaceId || !req.workspaceRole) {
    throw new AppError(status.UNAUTHORIZED, "Authentication is required");
  }

  if (
    req.workspaceRole !== WorkspaceMemberRole.OWNER &&
    req.workspaceRole !== WorkspaceMemberRole.ADMIN
  ) {
    throw new AppError(status.FORBIDDEN, "You are not authorized to access analytics");
  }
};

const buildDateRangeFilter = (
  field: string,
  from?: Date,
  to?: Date
): Prisma.ProjectWhereInput | Prisma.TaskWhereInput | Prisma.InvoiceWhereInput => {
  if (!from && !to) {
    return {};
  }

  return {
    [field]: {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    },
  };
};

const buildProjectWhere = (
  workspaceId: string,
  query: IAnalyticsProjectsQuery
): Prisma.ProjectWhereInput => {
  return {
    workspaceId,
    deletedAt: null,
    ...(query.from || query.to
      ? (buildDateRangeFilter("createdAt", query.from, query.to) as Prisma.ProjectWhereInput)
      : {}),
  };
};

const buildTaskWhere = (
  workspaceId: string,
  query: IAnalyticsProjectsQuery
): Prisma.TaskWhereInput => {
  return {
    workspaceId,
    deletedAt: null,
    project: {
      deletedAt: null,
      workspaceId,
    },
    ...(query.from || query.to
      ? (buildDateRangeFilter("createdAt", query.from, query.to) as Prisma.TaskWhereInput)
      : {}),
  };
};

const buildRevenueWhere = (
  workspaceId: string,
  query: IAnalyticsRevenueQuery
): Prisma.InvoiceWhereInput => {
  const dateRange =
    query.from || query.to
      ? {
          OR: [
            {
              issuedAt: {
                ...(query.from ? { gte: query.from } : {}),
                ...(query.to ? { lte: query.to } : {}),
              },
            },
            {
              issuedAt: null,
              createdAt: {
                ...(query.from ? { gte: query.from } : {}),
                ...(query.to ? { lte: query.to } : {}),
              },
            },
          ],
        }
      : {};

  return {
    workspaceId,
    deletedAt: null,
    ...(query.currency
      ? {
          currency: query.currency.toUpperCase(),
        }
      : {}),
    ...dateRange,
  };
};

const mapGroupedCount = <T extends string>(
  rows: Array<{ status: T; _count: { _all: number } }>
) => {
  return rows.reduce<Record<string, number>>((acc, row) => {
    acc[String(row.status)] = row._count._all;
    return acc;
  }, {});
};

const monthKeyFromDate = (date: Date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const getProjectsAnalytics = async (
  req: Request,
  query: IAnalyticsProjectsQuery
): Promise<IProjectsAnalyticsResponse> => {
  ensureAdminScope(req);

  const workspaceId = req.workspaceId!;
  const limit = Math.min(Math.max(Number(query.limit) || 5, 1), 20);

  const projectWhere = buildProjectWhere(workspaceId, query);
  const taskWhere = buildTaskWhere(workspaceId, query);

  const [totalProjects, groupedProjects, totalTasks, groupedTasks, overdueTasks, topProjectsRaw] =
    await Promise.all([
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
          dueDate: { lt: new Date() },
          status: { not: TaskStatus.DONE },
        },
      }),
      prisma.project.findMany({
        where: projectWhere,
        take: limit,
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          name: true,
          status: true,
          _count: {
            select: {
              members: true,
              tasks: {
                where: {
                  deletedAt: null,
                },
              },
            },
          },
        },
      }),
    ]);

  const topProjectIds = topProjectsRaw.map((project) => project.id);

  const [topProjectTaskStatuses, topProjectOverdueTasks] = topProjectIds.length
    ? await Promise.all([
        prisma.task.groupBy({
          by: ["projectId", "status"],
          where: {
            workspaceId,
            deletedAt: null,
            projectId: { in: topProjectIds },
          },
          _count: {
            _all: true,
          },
        }),
        prisma.task.groupBy({
          by: ["projectId"],
          where: {
            workspaceId,
            deletedAt: null,
            projectId: { in: topProjectIds },
            dueDate: { lt: new Date() },
            status: { not: TaskStatus.DONE },
          },
          _count: {
            _all: true,
          },
        }),
      ])
    : [[], []];

  const overdueByProject = topProjectOverdueTasks.reduce<Record<string, number>>((acc, row) => {
    acc[row.projectId] = row._count._all;
    return acc;
  }, {});

  const taskStatusByProject = topProjectTaskStatuses.reduce<Record<string, Record<string, number>>>(
    (acc, row) => {
      if (!acc[row.projectId]) {
        acc[row.projectId] = {};
      }

      acc[row.projectId]![String(row.status)] = row._count._all;
      return acc;
    },
    {}
  );

  const projectStatusMap = mapGroupedCount<ProjectStatus>(groupedProjects);
  const taskStatusMap = mapGroupedCount<TaskStatus>(groupedTasks);

  const topProjects: ITopProjectAnalyticsItem[] = topProjectsRaw.map((project) => {
    const taskMap = taskStatusByProject[project.id] ?? {};
    const done = taskMap[TaskStatus.DONE] ?? 0;
    const total = project._count.tasks;
    const completionRate = total > 0 ? Number(((done / total) * 100).toFixed(2)) : 0;

    return {
      projectId: project.id,
      name: project.name,
      status: project.status,
      membersCount: project._count.members,
      tasks: {
        total,
        todo: taskMap[TaskStatus.TODO] ?? 0,
        inProgress: taskMap[TaskStatus.IN_PROGRESS] ?? 0,
        review: taskMap[TaskStatus.REVIEW] ?? 0,
        done,
        overdue: overdueByProject[project.id] ?? 0,
        completionRate,
      },
    };
  });

  const doneTasks = taskStatusMap[TaskStatus.DONE] ?? 0;

  return {
    range: {
      from: query.from ?? null,
      to: query.to ?? null,
    },
    summary: {
      projects: {
        total: totalProjects,
        active: projectStatusMap[ProjectStatus.ACTIVE] ?? 0,
        completed: projectStatusMap[ProjectStatus.COMPLETED] ?? 0,
        onHold: projectStatusMap[ProjectStatus.ON_HOLD] ?? 0,
        archived: projectStatusMap[ProjectStatus.ARCHIVED] ?? 0,
      },
      tasks: {
        total: totalTasks,
        todo: taskStatusMap[TaskStatus.TODO] ?? 0,
        inProgress: taskStatusMap[TaskStatus.IN_PROGRESS] ?? 0,
        review: taskStatusMap[TaskStatus.REVIEW] ?? 0,
        done: doneTasks,
        overdue: overdueTasks,
        completionRate: totalTasks > 0 ? Number(((doneTasks / totalTasks) * 100).toFixed(2)) : 0,
      },
    },
    topProjects,
  };
};

const getRevenueAnalytics = async (
  req: Request,
  query: IAnalyticsRevenueQuery
): Promise<IRevenueAnalyticsResponse> => {
  ensureAdminScope(req);

  const workspaceId = req.workspaceId!;
  const where = buildRevenueWhere(workspaceId, query);

  const invoices = await prisma.invoice.findMany({
    where,
    orderBy: [{ issuedAt: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      amount: true,
      currency: true,
      status: true,
      issuedAt: true,
      createdAt: true,
      paidAt: true,
      dueAt: true,
    },
  });

  const summary = {
    totalInvoices: invoices.length,
    paidInvoices: 0,
    pendingInvoices: 0,
    overdueInvoices: 0,
    canceledInvoices: 0,
  };

  const totalsMap = new Map<string, IRevenueTotalsByCurrency>();
  const monthlyMap = new Map<string, IRevenueMonthlySeriesItem>();

  for (const invoice of invoices) {
    const currency = invoice.currency.toUpperCase();

    const totals = totalsMap.get(currency) ?? {
      currency,
      invoiceCount: 0,
      paidCount: 0,
      unpaidCount: 0,
      overdueCount: 0,
      issuedAmount: formatMoney(0),
      collectedAmount: formatMoney(0),
      outstandingAmount: formatMoney(0),
      overdueAmount: formatMoney(0),
    };

    totals.invoiceCount += 1;
    totals.issuedAmount = formatMoney(new Prisma.Decimal(totals.issuedAmount).plus(invoice.amount));

    const invoiceDate = invoice.issuedAt ?? invoice.createdAt;
    const monthKey = monthKeyFromDate(invoiceDate);
    const monthlyKey = `${monthKey}:${currency}`;

    const monthly = monthlyMap.get(monthlyKey) ?? {
      month: monthKey,
      currency,
      issuedAmount: formatMoney(0),
      collectedAmount: formatMoney(0),
    };

    monthly.issuedAmount = formatMoney(
      new Prisma.Decimal(monthly.issuedAmount).plus(invoice.amount)
    );

    switch (invoice.status) {
      case InvoiceStatus.PAID:
        summary.paidInvoices += 1;
        totals.paidCount += 1;
        totals.collectedAmount = formatMoney(
          new Prisma.Decimal(totals.collectedAmount).plus(invoice.amount)
        );
        monthly.collectedAmount = formatMoney(
          new Prisma.Decimal(monthly.collectedAmount).plus(invoice.amount)
        );
        break;

      case InvoiceStatus.OVERDUE:
        summary.overdueInvoices += 1;
        totals.unpaidCount += 1;
        totals.overdueCount += 1;
        totals.outstandingAmount = formatMoney(
          new Prisma.Decimal(totals.outstandingAmount).plus(invoice.amount)
        );
        totals.overdueAmount = formatMoney(
          new Prisma.Decimal(totals.overdueAmount).plus(invoice.amount)
        );
        break;

      case InvoiceStatus.PENDING:
        summary.pendingInvoices += 1;
        totals.unpaidCount += 1;
        totals.outstandingAmount = formatMoney(
          new Prisma.Decimal(totals.outstandingAmount).plus(invoice.amount)
        );
        break;

      case InvoiceStatus.CANCELED:
        summary.canceledInvoices += 1;
        break;

      default:
        break;
    }

    totalsMap.set(currency, totals);
    monthlyMap.set(monthlyKey, monthly);
  }

  return {
    range: {
      from: query.from ?? null,
      to: query.to ?? null,
    },
    summary,
    totalsByCurrency: Array.from(totalsMap.values()).sort((a, b) =>
      a.currency.localeCompare(b.currency)
    ),
    monthlySeries: Array.from(monthlyMap.values()).sort((a, b) => {
      if (a.month === b.month) {
        return a.currency.localeCompare(b.currency);
      }

      return a.month.localeCompare(b.month);
    }),
  };
};

export const AnalyticsService = {
  getProjectsAnalytics,
  getRevenueAnalytics,
};
