import { SubscriptionPlan } from "../../generated/prisma/enums";

export const PLAN_ESTIMATED_REVENUE = {
  [SubscriptionPlan.FREE]: {
    month: 0,
    year: 0,
  },
  [SubscriptionPlan.PRO]: {
    month: 2900, // $29.00
    year: 29000, // $290.00 (~$24/mo)
  },
  [SubscriptionPlan.ENTERPRISE]: {
    month: 19900, // $199.00
    year: 199000, // $1990.00
  },
} as const;

export type PlanPriceInterval = "month" | "year";
