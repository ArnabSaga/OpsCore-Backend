import { WorkspaceMemberRole } from "../../constants/role";
import { SubscriptionPlan } from "../../constants/subscription";

export interface IDashboardOverviewQuery {
  // no query params for now, kept for symmetry/extensibility
}

export interface IDashboardActivityQuery {
  page?: number;
  limit?: number;
}

export interface IDashboardMoneyByCurrency {
  currency: string;
  collectedAmount: string;
  outstandingAmount: string;
}

export interface IDashboardInvoiceSummary {
  total: number;
  pending: number;
  paid: number;
  overdue: number;
  canceled: number;
  totalsByCurrency: IDashboardMoneyByCurrency[];
}

export interface IDashboardOverviewResponse {
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
  };
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
  invoices: IDashboardInvoiceSummary | null;
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

export interface IDashboardActivityResponse {
  data: IDashboardActivityItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface IDashboardMetricsQuery {
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

export interface IDashboardMetricsResponse {
  revenue: ITimeSeriesRevenueDataPoint[];
  projects: ITimeSeriesDataPoint[];
  tasks: ITimeSeriesDataPoint[];
}
