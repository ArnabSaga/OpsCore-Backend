import { SubscriptionPlan, SubscriptionStatus } from "../../generated/prisma/enums";

export { SubscriptionPlan, SubscriptionStatus };

export const PAID_SUBSCRIPTION_PLANS = [SubscriptionPlan.PRO, SubscriptionPlan.ENTERPRISE] as const;

export const ACTIVE_SUBSCRIPTION_STATUSES = [SubscriptionStatus.ACTIVE] as const;

export const BILLING_PROBLEM_STATUSES = [
  SubscriptionStatus.PAST_DUE,
  SubscriptionStatus.INCOMPLETE,
] as const;

export const ENDED_SUBSCRIPTION_STATUSES = [SubscriptionStatus.CANCELED] as const;

export const DEFAULT_SUBSCRIPTION_PLAN = SubscriptionPlan.FREE;
