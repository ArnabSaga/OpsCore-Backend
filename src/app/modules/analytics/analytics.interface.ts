export interface IAnalyticsProjectsQuery {
  from?: Date;
  to?: Date;
  limit?: number;
}

export interface IAnalyticsRevenueQuery {
  from?: Date;
  to?: Date;
  currency?: string;
}

export interface IAnalyticsRange {
  from: Date | null;
  to: Date | null;
}

export interface IProjectsStatusBreakdown {
  total: number;
  active: number;
  completed: number;
  onHold: number;
  archived: number;
}

export interface ITasksAnalyticsBreakdown {
  total: number;
  todo: number;
  inProgress: number;
  review: number;
  done: number;
  overdue: number;
  completionRate: number;
}

export interface ITopProjectAnalyticsItem {
  projectId: string;
  name: string;
  status: string;
  membersCount: number;
  tasks: {
    total: number;
    todo: number;
    inProgress: number;
    review: number;
    done: number;
    overdue: number;
    completionRate: number;
  };
}

export interface IProjectsAnalyticsResponse {
  range: IAnalyticsRange;
  summary: {
    projects: IProjectsStatusBreakdown;
    tasks: ITasksAnalyticsBreakdown;
  };
  topProjects: ITopProjectAnalyticsItem[];
}

export interface IRevenueTotalsByCurrency {
  currency: string;
  invoiceCount: number;
  paidCount: number;
  unpaidCount: number;
  overdueCount: number;
  issuedAmount: string;
  collectedAmount: string;
  outstandingAmount: string;
  overdueAmount: string;
}

export interface IRevenueMonthlySeriesItem {
  month: string;
  currency: string;
  issuedAmount: string;
  collectedAmount: string;
}

export interface IRevenueAnalyticsResponse {
  range: IAnalyticsRange;
  summary: {
    totalInvoices: number;
    paidInvoices: number;
    pendingInvoices: number;
    overdueInvoices: number;
    canceledInvoices: number;
  };
  totalsByCurrency: IRevenueTotalsByCurrency[];
  monthlySeries: IRevenueMonthlySeriesItem[];
}
