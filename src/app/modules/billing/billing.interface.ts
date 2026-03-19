import { SubscriptionPlan, SubscriptionStatus } from "../../../generated/prisma/enums";

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
  basePlan: "FREE" | "PRO" | "ENTERPRISE";
  effectivePlan: "FREE" | "PRO" | "ENTERPRISE";
  isTrialActive: boolean;
  trialStartsAt: Date | null;
  trialEndsAt: Date | null;
  billingCycleStartsAt: Date;
  billingCycleEndsAt: Date;
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
  capabilities: {
    canCheckout: boolean;
    canOpenCustomerPortal: boolean;
  };
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
  number: string | null;
  status: string | null;
  currency: string | null;
  total: string | null;
  subtotal: string | null;
  amountPaid: string | null;
  amountDue: string | null;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  createdAt: Date | null;
}

export interface IBillingHistoryResponse {
  items: IBillingHistoryItem[];
  meta: {
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
  };
}

export interface ICustomerPortalResponse {
  url: string;
}
