import { Request, Response } from "express";
import status from "http-status";
import Stripe from "stripe";
import { SubscriptionStatus } from "../../../generated/prisma/enums";
import AppError from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import {
  getStripeClient,
  getStripeWebhookSecret,
  mapPriceIdToPlan,
  mapStripeStatusToSubscriptionStatus,
  unixToDate,
} from "./billing.utils";

const getWorkspaceIdFromStripeSubscription = async (subscription: Stripe.Subscription) => {
  const metadataWorkspaceId = subscription.metadata?.workspaceId;

  if (metadataWorkspaceId) {
    return metadataWorkspaceId;
  }

  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;

  if (!customerId) {
    return null;
  }

  const workspace = await prisma.workspace.findFirst({
    where: {
      stripeCustomerId: customerId,
      deletedAt: null,
    },
    select: {
      id: true,
    },
  });

  return workspace?.id ?? null;
};

const syncSubscriptionRecord = async (subscription: Stripe.Subscription) => {
  const workspaceId = await getWorkspaceIdFromStripeSubscription(subscription);

  if (!workspaceId) {
    throw new AppError(status.NOT_FOUND, "Workspace not found for Stripe subscription");
  }

  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const priceId = subscription.items.data[0]?.price?.id ?? null;
  const plan = mapPriceIdToPlan(priceId);
  const mappedStatus = mapStripeStatusToSubscriptionStatus(subscription.status);
  const currentPeriodStart = unixToDate(
    subscription.items.data[0]?.current_period_start ?? subscription.start_date
  );
  const currentPeriodEnd = unixToDate(subscription.items.data[0]?.current_period_end);

  await prisma.$transaction(async (tx) => {
    const workspace = await tx.workspace.findUnique({
      where: { id: workspaceId },
      select: { createdByUserId: true },
    });

    if (!workspace) {
      throw new AppError(status.NOT_FOUND, "Workspace not found while syncing subscription");
    }

    await tx.workspace.update({
      where: { id: workspaceId },
      data: {
        stripeCustomerId: customerId,
        billingCycleStartsAt: currentPeriodStart,
        billingCycleEndsAt: currentPeriodEnd,
      },
    });

    await tx.subscription.upsert({
      where: {
        stripeSubscriptionId: subscription.id,
      },
      update: {
        workspaceId,
        stripePriceId: priceId,
        plan,
        status: mappedStatus,
        currentPeriodStart,
        currentPeriodEnd,
        canceledAt: subscription.canceled_at ? unixToDate(subscription.canceled_at) : null,
      },
      create: {
        workspaceId,
        stripeSubscriptionId: subscription.id,
        stripePriceId: priceId,
        plan,
        status: mappedStatus,
        currentPeriodStart,
        currentPeriodEnd,
        canceledAt: subscription.canceled_at ? unixToDate(subscription.canceled_at) : null,
      },
    });

    await tx.activityLog.create({
      data: {
        workspaceId,
        userId: subscription.metadata?.initiatedByUserId || workspace.createdByUserId,
        action: `billing.subscription.${mappedStatus.toLowerCase()}`,
        entityType: "subscription",
        entityId: subscription.id,
        metadata: {
          stripeSubscriptionId: subscription.id,
          stripePriceId: priceId,
          plan,
          status: mappedStatus,
        },
      },
    });
  });
};

const handleCheckoutSessionCompleted = async (session: Stripe.Checkout.Session) => {
  const workspaceId = session.metadata?.workspaceId || session.client_reference_id;

  if (!workspaceId) {
    throw new AppError(status.BAD_REQUEST, "Checkout session is missing workspace metadata");
  }

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      stripeCustomerId:
        typeof session.customer === "string" ? session.customer : session.customer?.id || null,
    },
  });

  if (typeof session.subscription === "string") {
    const stripe = getStripeClient();
    const subscription = await stripe.subscriptions.retrieve(session.subscription, {
      expand: ["items.data.price"],
    });

    await syncSubscriptionRecord(subscription);
  }
};

const handleInvoicePaymentFailed = async (invoice: Stripe.Invoice) => {
  const subscription = invoice.parent?.subscription_details?.subscription;
  const stripeSubscriptionId =
    typeof subscription === "string" ? subscription : subscription?.id;

  if (!stripeSubscriptionId) {
    return;
  }

  await prisma.subscription.updateMany({
    where: {
      stripeSubscriptionId,
    },
    data: {
      status: SubscriptionStatus.PAST_DUE,
    },
  });
};

const handleInvoicePaid = async (invoice: Stripe.Invoice) => {
  const subscription = invoice.parent?.subscription_details?.subscription;
  const stripeSubscriptionId =
    typeof subscription === "string" ? subscription : subscription?.id;

  if (!stripeSubscriptionId) {
    return;
  }

  await prisma.subscription.updateMany({
    where: {
      stripeSubscriptionId,
    },
    data: {
      status: SubscriptionStatus.ACTIVE,
    },
  });
};

export const stripeWebhook = async (req: Request, res: Response) => {
  try {
    const signature = req.headers["stripe-signature"];

    if (!signature || typeof signature !== "string") {
      throw new AppError(status.BAD_REQUEST, "Missing Stripe signature");
    }

    const stripe = getStripeClient();
    const webhookSecret = getStripeWebhookSecret();
    const event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);

    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscriptionRecord(event.data.object as Stripe.Subscription);
        break;
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      case "invoice.paid":
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      default:
        break;
    }

    return res.status(status.OK).json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook processing failed";
    return res.status(status.BAD_REQUEST).json({ success: false, message });
  }
};
