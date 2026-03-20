import { z } from "zod";
import { SubscriptionPlan } from "../../constants/subscription";

const getBillingHistoryQuerySchema = z.object({
  query: z.object({
    limit: z.coerce.number().int().min(1).max(100).optional(),
    startingAfter: z.string().trim().min(1).optional(),
  }),
});

const prepareCheckoutSchema = z.object({
  body: z.object({
    plan: z.nativeEnum(SubscriptionPlan),
    billingInterval: z.enum(["month", "year"]).optional(),
    successUrl: z.string().trim().url().optional(),
    cancelUrl: z.string().trim().url().optional(),
  }),
});

const createCustomerPortalSchema = z.object({
  body: z.object({
    returnUrl: z.string().trim().url().optional(),
  }),
});

export const BillingValidation = {
  getBillingHistoryQuerySchema,
  prepareCheckoutSchema,
  createCustomerPortalSchema,
};
