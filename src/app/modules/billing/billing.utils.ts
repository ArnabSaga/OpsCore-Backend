import Stripe from "stripe";
import { SubscriptionPlan, SubscriptionStatus } from "../../../generated/prisma/enums";
import { envVars } from "../../config/env";
import AppError from "../../errors/AppError";
import status from "http-status";

export type BillingInterval = "month" | "year";

const ensureStripeEnv = (value: string | undefined, key: string) => {
  if (!value) {
    throw new AppError(status.INTERNAL_SERVER_ERROR, `${key} is not configured`);
  }

  return value;
};

let stripeSingleton: Stripe | null = null;

export const getStripeClient = () => {
  if (!stripeSingleton) {
    const secretKey = ensureStripeEnv(
      envVars.STRIPE.STRIPE_SECRET_KEY,
      "STRIPE_SECRET_KEY"
    );

    stripeSingleton = new Stripe(secretKey, {
      apiVersion: "2026-02-25.clover",
      typescript: true,
    });
  }

  return stripeSingleton;
};

export const getStripeWebhookSecret = () => {
  return ensureStripeEnv(
    envVars.STRIPE.STRIPE_WEBHOOK_SECRET,
    "STRIPE_WEBHOOK_SECRET"
  );
};

export const normalizeBillingInterval = (value?: string | null): BillingInterval => {
  return value === "year" ? "year" : "month";
};

export const getStripePriceIdForPlan = (
  plan: Exclude<SubscriptionPlan, "FREE">,
  billingInterval: BillingInterval
) => {
  const dynamicEnv = envVars as typeof envVars & {
    STRIPE_PRICE_PRO_MONTHLY?: string;
    STRIPE_PRICE_PRO_YEARLY?: string;
    STRIPE_PRICE_ENTERPRISE_MONTHLY?: string;
    STRIPE_PRICE_ENTERPRISE_YEARLY?: string;
  };

  const mapping: Record<
    Exclude<SubscriptionPlan, "FREE">,
    Record<BillingInterval, string | undefined>
  > = {
    PRO: {
      month: dynamicEnv.STRIPE_PRICE_PRO_MONTHLY,
      year: dynamicEnv.STRIPE_PRICE_PRO_YEARLY,
    },
    ENTERPRISE: {
      month: dynamicEnv.STRIPE_PRICE_ENTERPRISE_MONTHLY,
      year: dynamicEnv.STRIPE_PRICE_ENTERPRISE_YEARLY,
    },
  };

  const priceId = mapping[plan][billingInterval];

  if (!priceId) {
    throw new AppError(
      status.INTERNAL_SERVER_ERROR,
      `Stripe price is not configured for ${plan} (${billingInterval})`
    );
  }

  return priceId;
};

export const mapStripeStatusToSubscriptionStatus = (
  stripeStatus?: Stripe.Subscription.Status | null
): SubscriptionStatus => {
  switch (stripeStatus) {
    case "active":
    case "trialing":
      return SubscriptionStatus.ACTIVE;
    case "past_due":
    case "unpaid":
    case "paused":
      return SubscriptionStatus.PAST_DUE;
    case "incomplete":
    case "incomplete_expired":
      return SubscriptionStatus.INCOMPLETE;
    case "canceled":
      return SubscriptionStatus.CANCELED;
    default:
      return SubscriptionStatus.INCOMPLETE;
  }
};

export const mapPriceIdToPlan = (priceId?: string | null): SubscriptionPlan => {
  const dynamicEnv = envVars as typeof envVars & {
    STRIPE_PRICE_PRO_MONTHLY?: string;
    STRIPE_PRICE_PRO_YEARLY?: string;
    STRIPE_PRICE_ENTERPRISE_MONTHLY?: string;
    STRIPE_PRICE_ENTERPRISE_YEARLY?: string;
  };

  if (!priceId) {
    return SubscriptionPlan.FREE;
  }

  const proPriceIds = [
    dynamicEnv.STRIPE_PRICE_PRO_MONTHLY,
    dynamicEnv.STRIPE_PRICE_PRO_YEARLY,
  ].filter(Boolean);
  const enterprisePriceIds = [
    dynamicEnv.STRIPE_PRICE_ENTERPRISE_MONTHLY,
    dynamicEnv.STRIPE_PRICE_ENTERPRISE_YEARLY,
  ].filter(Boolean);

  if (proPriceIds.includes(priceId)) {
    return SubscriptionPlan.PRO;
  }

  if (enterprisePriceIds.includes(priceId)) {
    return SubscriptionPlan.ENTERPRISE;
  }

  return SubscriptionPlan.FREE;
};

export const centsToMoneyString = (amount?: number | null) => {
  if (typeof amount !== "number") return null;
  return (amount / 100).toFixed(2);
};

export const unixToDate = (value?: number | null) => {
  return typeof value === "number" ? new Date(value * 1000) : null;
};
