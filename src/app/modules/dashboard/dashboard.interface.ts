import { WorkspaceMemberRole } from "../../constants/role";
import { SubscriptionPlan } from "../../constants/subscription";

export interface IWorkspaceDashboardOverviewQuery {}

export interface IWorkspaceDashboardActivityQuery {
  page?: number;
  limit?: number;
}

export interface IWorkspaceDashboardMoneyByCurrency {
  currency: string;
  collectedAmount: string;
  outstandingAmount: string;
}

export interface IWorkspaceDashboardInvoiceSummary {
  total: number;
  pending: number;
  paid: number;
  overdue: number;
  canceled: number;
  totalsByCurrency: IWorkspaceDashboardMoneyByCurrency[];
}

export interface IWorkspaceDashboardOverviewResponse {
  scope: "workspace" | "member";
  workspace: {
    id: string;
    name: string;
    slug: string;
    role: WorkspaceMemberRole;
  };
  subscription: {
    basePlan: SubscriptionPlan;
    effectivePlan: SubscriptionPlan;
    isTrialActive: boolean;
    trialEndsAt: Date | null;
    billingCycleStartsAt: Date;
    billingCycleEndsAt: Date;
  } | null;
  projects: {
    total: number;
    active: number;
    completed: number;
    onHold: number;
    archived: number;
  };
  tasks: {
    total: number;
    todo: number;
    inProgress: number;
    review: number;
    done: number;
    overdue: number;
    dueToday: number;
    assignedToMe: number;
    createdByMe: number;
  };
  invoices: IWorkspaceDashboardInvoiceSummary | null;
}

export interface IDashboardActivityActor {
  id: string;
  name: string;
  email: string;
  image: string | null;
}

export interface IDashboardActivityItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  actor: IDashboardActivityActor;
}

export interface IWorkspaceDashboardActivityResponse {
  data: IDashboardActivityItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface IWorkspaceDashboardMetricsQuery {
  period?: "last_7_days" | "last_30_days" | "last_3_months" | "last_12_months";
}

export interface ITimeSeriesRevenueDataPoint {
  date: string;
  amount: number;
  currency: string;
}

export interface ITimeSeriesDataPoint {
  date: string;
  created: number;
  completed: number;
}

export interface IWorkspaceDashboardMetricsResponse {
  revenue: ITimeSeriesRevenueDataPoint[];
  projects: ITimeSeriesDataPoint[];
  tasks: ITimeSeriesDataPoint[];
}

export interface IPlatformDashboardOverviewQuery {}

export interface IPlatformDashboardOverviewResponse {
  scope: "platform";
  workspaces: {
    total: number;
    active: number;
  };
  users: {
    total: number;
    active: number;
  };
  subscriptions: {
    paid: number;
    trial: number;
  };
  invoices: {
    total: number;
    overdue: number;
  };
}

export interface IPlatformDashboardActivityQuery {
  page?: number;
  limit?: number;
}

export interface IPlatformDashboardActivityResponse {
  data: IDashboardActivityItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface IPlatformDashboardMetricsQuery {
  period?: "last_7_days" | "last_30_days" | "last_3_months" | "last_12_months";
}

export interface IPlatformDashboardMetricsResponse {
  revenue: ITimeSeriesRevenueDataPoint[];
  workspaces: ITimeSeriesDataPoint[];
  users: ITimeSeriesDataPoint[];
  subscriptions: { date: string; trials: number; paid: number; canceled: number }[];
  invoices: { date: string; created: number; paid: number }[];
}
