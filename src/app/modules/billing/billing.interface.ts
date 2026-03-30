import { PlanLimitKey } from "../../config/planFeatures";
import { SubscriptionPlan, SubscriptionStatus } from "../../constants/subscription";

export interface IGetBillingHistoryQuery {
  limit?: number;
  startingAfter?: string;
}

export interface IPrepareCheckoutPayload {
  plan: Exclude<SubscriptionPlan, "FREE">;
  billingInterval?: "month" | "year";
  successUrl?: string;
  cancelUrl?: string;
}

export interface ICreateCustomerPortalPayload {
  returnUrl?: string;
}

export interface IResolvedPlanSummary {
  basePlan: SubscriptionPlan;
  effectivePlan: SubscriptionPlan;
  isTrialActive: boolean;
  trialStartsAt: Date | null;
  trialEndsAt: Date | null;
  billingCycleStartsAt: Date;
  billingCycleEndsAt: Date;
}

export interface IBillingCapability {
  key: string;
  label: string;
  enabled: boolean;
}

export interface ICurrentWorkspaceSubscriptionResponse {
  workspace: {
    id: string;
    name: string;
    slug: string;
    stripeCustomerId: string | null;
  };
  subscription: {
    id: string | null;
    stripeSubscriptionId: string | null;
    stripePriceId: string | null;
    plan: SubscriptionPlan;
    status: SubscriptionStatus | "TRIALING" | "NONE";
    currentPeriodStart: Date | null;
    currentPeriodEnd: Date | null;
    canceledAt: Date | null;
    createdAt: Date | null;
    updatedAt: Date | null;
  };
  planSummary: IResolvedPlanSummary;
  capabilities: IBillingCapability[];
}

export interface IPreparedCheckoutResponse {
  checkoutSessionId: string;
  checkoutUrl: string;
  customerId: string;
  workspaceId: string;
  plan: SubscriptionPlan;
  billingInterval: "month" | "year";
  mode: "subscription";
  expiresAt: Date | null;
}

export interface IBillingHistoryItem {
  id: string;
  stripeInvoiceId: string | null;
  invoiceNumber: string | null;
  status: string;
  currency: string;
  subtotalAmount: string;
  taxAmount: string;
  totalAmount: string;
  amountPaid: string;
  amountDue: string;
  hostedInvoiceUrl: string | null;
  invoicePdfUrl: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  issuedAt: string | null;
  dueAt: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface IBillingHistoryResponse {
  invoices: IBillingHistoryItem[];
  hasMore: boolean;
  nextCursor: string | null;
}

export interface ICustomerPortalResponse {
  url: string;
}

export interface IUsageMetric {
  key: string;
  label: string;
  usage: number;
  limit: number | null;
  remaining: number | null;
  unlimited: boolean;
}

export interface IUsageResponse {
  metrics: IUsageMetric[];
}

export interface IPlatformSubscriptionItem {
  id: string;
  workspaceId: string;
  workspace: {
    id: string;
    name: string;
    slug: string;
    ownerEmail: string;
  };
  plan: SubscriptionPlan;
  status: SubscriptionStatus | "TRIALING" | "NONE";
  billingInterval: "month" | "year" | null;
  currentPeriodEnd: Date | null;
  createdAt: Date;
}

export interface IPlatformSubscriptionsResponse {
  items: IPlatformSubscriptionItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}


