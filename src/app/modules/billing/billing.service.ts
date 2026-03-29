import { Request } from "express";
import status from "http-status";
import Stripe from "stripe";
import { SubscriptionPlan, SubscriptionStatus } from "../../constants/subscription";
import { WorkspaceMemberRole } from "../../constants/role";
import AppError from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import {
  resolveWorkspacePlanContext,
  getCurrentPlanUsage,
  getPlanLimit,
} from "../../utils/checkPlanLimit";
import { PLAN_FEATURES, PlanFeatureKey } from "../../config/planFeatures";
import {
  IBillingHistoryResponse,
  ICreateCustomerPortalPayload,
  ICurrentWorkspaceSubscriptionResponse,
  IGetBillingHistoryQuery,
  IPrepareCheckoutPayload,
  IPreparedCheckoutResponse,
  IUsageResponse,
} from "./billing.interface";
import {
  centsToMoneyString,
  getStripeClient,
  getStripePriceIdForPlan,
  normalizeBillingInterval,
  unixToDate,
} from "./billing.utils";

const FEATURE_LABELS: Record<string, string> = {
  "workspace.multiWorkspace": "Multiple Workspaces",
  "workspace.customBranding": "Custom Branding",
  "workspace.advancedPermissions": "Advanced Permissions",
  "workspace.memberManagement": "Member Management",
  "projects.create": "Project Creation",
  "projects.archive": "Project Archiving",
  "projects.assignMembers": "Resource Assignment",
  "tasks.create": "Task Management",
  "tasks.comments": "Task Discussions",
  "tasks.attachments": "Task Attachments",
  "tasks.advancedFilters": "Advanced Search/Filter",
  "invoices.create": "Invoice Creation",
  "invoices.send": "Invoice Sending",
  "billing.customerPortal": "Self-Service Billing",
  "billing.checkout": "Stripe Integration",
  "dashboard.overview": "Dashboard Overview",
  "dashboard.activity": "Recent Activity Feed",
  "analytics.projects": "Project Analytics",
  "analytics.revenue": "Revenue Insights",
  "activityLogs.read": "Access Logs",
  "activityLogs.export": "Export Logs",
  "automation.basic": "Basic Automation",
  "automation.advanced": "Full Automation Suite",
  "notifications.email": "Email Notifications",
  "api.webhooks": "Webhook Support",
  "support.priority": "Priority Support",
};

const prettifyFeatureKey = (key: string): string => {
  return key
    .split(".")
    .pop()!
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
};

const getWorkspaceOrThrow = async (workspaceId: string) => {
  const workspace = await prisma.workspace.findFirst({
    where: {
      id: workspaceId,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      stripeCustomerId: true,
      createdByUserId: true,
      deletedAt: true,
    },
  });

  if (!workspace) {
    throw new AppError(status.NOT_FOUND, "Workspace not found");
  }

  return workspace;
};

const getLatestWorkspaceSubscription = async (workspaceId: string) => {
  return prisma.subscription.findFirst({
    where: {
      workspaceId,
    },
    orderBy: [{ currentPeriodEnd: "desc" }, { updatedAt: "desc" }, { createdAt: "desc" }],
  });
};

const ensureWorkspaceOwner = (req: Request) => {
  if (!req.user) {
    throw new AppError(status.UNAUTHORIZED, "Authentication is required");
  }

  if (req.workspaceRole !== WorkspaceMemberRole.OWNER) {
    throw new AppError(status.FORBIDDEN, "Only workspace owners can manage billing");
  }
};

const getOrCreateStripeCustomer = async (
  workspace: Awaited<ReturnType<typeof getWorkspaceOrThrow>>
) => {
  const stripe = getStripeClient();

  if (workspace.stripeCustomerId) {
    try {
      const existingCustomer = await stripe.customers.retrieve(workspace.stripeCustomerId);
      if (!("deleted" in existingCustomer && existingCustomer.deleted)) {
        return existingCustomer as Stripe.Customer;
      }
    } catch {
      // fall through to recreate customer
    }
  }

  const customer = await stripe.customers.create({
    name: workspace.name,
    email: undefined,
    metadata: {
      workspaceId: workspace.id,
      workspaceSlug: workspace.slug,
      workspaceName: workspace.name,
      createdByUserId: workspace.createdByUserId,
    },
  });

  await prisma.workspace.update({
    where: { id: workspace.id },
    data: {
      stripeCustomerId: customer.id,
    },
  });

  return customer;
};

const getCurrentWorkspaceSubscription = async (
  req: Request
): Promise<ICurrentWorkspaceSubscriptionResponse> => {
  try {
    ensureWorkspaceOwner(req);

    const workspaceId = req.workspaceId!;

    const [workspace, latestSubscription, planContext] = await Promise.all([
      getWorkspaceOrThrow(workspaceId),
      getLatestWorkspaceSubscription(workspaceId),
      resolveWorkspacePlanContext(workspaceId),
    ]);

    return {
      workspace: {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        stripeCustomerId: workspace.stripeCustomerId,
      },
      subscription: {
        id: latestSubscription?.id ?? null,
        stripeSubscriptionId: latestSubscription?.stripeSubscriptionId ?? null,
        stripePriceId: latestSubscription?.stripePriceId ?? null,
        plan: latestSubscription?.plan ?? SubscriptionPlan.FREE,
        status: latestSubscription?.status ?? (planContext.isTrialActive ? "TRIALING" : "NONE"),
        currentPeriodStart: latestSubscription?.currentPeriodStart ?? null,
        currentPeriodEnd: latestSubscription?.currentPeriodEnd ?? null,
        canceledAt: latestSubscription?.canceledAt ?? null,
        createdAt: latestSubscription?.createdAt ?? null,
        updatedAt: latestSubscription?.updatedAt ?? null,
      },
      planSummary: {
        basePlan: planContext.basePlan,
        effectivePlan: planContext.effectivePlan,
        isTrialActive: planContext.isTrialActive,
        trialStartsAt: planContext.trialStartedAt,
        trialEndsAt: planContext.trialEndsAt,
        billingCycleStartsAt: planContext.billingCycleStartsAt,
        billingCycleEndsAt: planContext.billingCycleEndsAt,
      },
      capabilities: Object.entries(PLAN_FEATURES[planContext.effectivePlan].flags).map(
        ([key, enabled]) => ({
          key,
          label: FEATURE_LABELS[key] || prettifyFeatureKey(key),
          enabled,
        })
      ),
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to fetch workspace subscription");
  }
};

const prepareCheckoutFlow = async (req: Request): Promise<IPreparedCheckoutResponse> => {
  try {
    ensureWorkspaceOwner(req);

    const workspaceId = req.workspaceId!;
    const payload = req.body as IPrepareCheckoutPayload;

    const workspace = await getWorkspaceOrThrow(workspaceId);
    const billingInterval = normalizeBillingInterval(payload.billingInterval);
    const plan = payload.plan as SubscriptionPlan;

    if (plan === SubscriptionPlan.ENTERPRISE) {
      throw new AppError(status.BAD_REQUEST, "ENTERPRISE plan requires custom checkout");
    }
    if (plan === SubscriptionPlan.FREE) {
      throw new AppError(status.BAD_REQUEST, "FREE plan does not require checkout");
    }

    const existingSubscription = await getLatestWorkspaceSubscription(workspaceId);

    if (
      existingSubscription?.status === SubscriptionStatus.ACTIVE &&
      existingSubscription.plan === plan
    ) {
      throw new AppError(status.CONFLICT, `Workspace is already subscribed to the ${plan} plan`);
    }

    const stripe = getStripeClient();
    const customer = await getOrCreateStripeCustomer(workspace);
    const priceId = getStripePriceIdForPlan(plan, billingInterval);

    const successUrl =
      payload.successUrl?.trim() ||
      `${process.env.FRONTEND_URL || "http://localhost:3000"}/billing/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl =
      payload.cancelUrl?.trim() ||
      `${process.env.FRONTEND_URL || "http://localhost:3000"}/billing/cancel`;

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customer.id,
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: workspace.id,
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      metadata: {
        workspaceId: workspace.id,
        workspaceSlug: workspace.slug,
        selectedPlan: plan,
        billingInterval,
        initiatedByUserId: req.user!.id,
      },
      subscription_data: {
        metadata: {
          workspaceId: workspace.id,
          workspaceSlug: workspace.slug,
          selectedPlan: plan,
          billingInterval,
          initiatedByUserId: req.user!.id,
        },
      },
    });

    if (!checkoutSession.url) {
      throw new AppError(status.INTERNAL_SERVER_ERROR, "Stripe did not return a checkout URL");
    }

    return {
      checkoutSessionId: checkoutSession.id,
      checkoutUrl: checkoutSession.url,
      customerId: customer.id,
      workspaceId: workspace.id,
      plan,
      billingInterval,
      mode: "subscription",
      expiresAt: unixToDate(checkoutSession.expires_at),
    };
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      status.INTERNAL_SERVER_ERROR,
      `Failed to prepare checkout flow: ${error?.message || "Unknown error"}`
    );
  }
};

const createCustomerPortal = async (req: Request) => {
  try {
    ensureWorkspaceOwner(req);

    const workspaceId = req.workspaceId!;
    const payload = req.body as ICreateCustomerPortalPayload;
    const workspace = await getWorkspaceOrThrow(workspaceId);

    if (!workspace.stripeCustomerId) {
      throw new AppError(status.BAD_REQUEST, "This workspace does not have a Stripe customer yet");
    }

    const stripe = getStripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: workspace.stripeCustomerId,
      return_url:
        payload.returnUrl?.trim() ||
        `${process.env.FRONTEND_URL || "http://localhost:3000"}/settings/billing`,
    });

    return { url: session.url };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to create customer portal session");
  }
};

const getBillingHistory = async (req: Request): Promise<IBillingHistoryResponse> => {
  try {
    ensureWorkspaceOwner(req);

    const workspaceId = req.workspaceId!;
    const query = req.query as unknown as IGetBillingHistoryQuery;
    const workspace = await getWorkspaceOrThrow(workspaceId);

    if (!workspace.stripeCustomerId) {
      return {
        invoices: [],
        hasMore: false,
        nextCursor: null,
      };
    }

    const stripe = getStripeClient();
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);

    const invoiceList = await stripe.invoices.list({
      customer: workspace.stripeCustomerId,
      limit,
      starting_after: query.startingAfter,
    });

    return {
      invoices: invoiceList.data.map((invoice) => ({
        id: invoice.id,
        stripeInvoiceId: invoice.id,
        invoiceNumber: invoice.number,
        status: invoice.status || "open",
        currency: invoice.currency?.toUpperCase() ?? "USD",
        subtotalAmount: centsToMoneyString(invoice.subtotal) ?? "0.00",
        taxAmount: centsToMoneyString((invoice as any).tax || 0) ?? "0.00",
        totalAmount: centsToMoneyString(invoice.total) ?? "0.00",
        amountPaid: centsToMoneyString(invoice.amount_paid) ?? "0.00",
        amountDue: centsToMoneyString(invoice.amount_due) ?? "0.00",
        hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
        invoicePdfUrl: invoice.invoice_pdf ?? null,
        periodStart: unixToDate(invoice.period_start)?.toISOString() ?? null,
        periodEnd: unixToDate(invoice.period_end)?.toISOString() ?? null,
        issuedAt: unixToDate(invoice.created)?.toISOString() ?? null,
        dueAt: invoice.due_date ? unixToDate(invoice.due_date)?.toISOString() ?? null : null,
        paidAt: invoice.status_transitions?.paid_at
          ? unixToDate(invoice.status_transitions.paid_at)?.toISOString() ?? null
          : null,
        createdAt: unixToDate(invoice.created)?.toISOString() ?? new Date().toISOString(),
      })),
      hasMore: invoiceList.has_more,
      nextCursor: invoiceList.data.at(-1)?.id ?? null,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to fetch billing history");
  }
};

const getUsage = async (req: Request): Promise<IUsageResponse> => {
  try {
    ensureWorkspaceOwner(req);
    const workspaceId = req.workspaceId!;

    const resourcesToTrack = [
      "members",
      "projects",
      "tasks",
      "storageMb",
      "monthlyInvitations"
    ] as const;

    const metrics = await Promise.all(
      resourcesToTrack.map(async (resource) => {
        const [planLimit, currentUsage] = await Promise.all([
          getPlanLimit(workspaceId, resource),
          getCurrentPlanUsage({ workspaceId, limitKey: resource }),
        ]);

        const METRIC_LABELS: Record<string, string> = {
          members: "Team Members",
          projects: "Active Projects",
          tasks: "Task Items",
          storageMb: "Storage (MB)",
          monthlyInvitations: "Monthly Invitations",
        };

        return {
          key: resource,
          label: METRIC_LABELS[resource] || prettifyFeatureKey(resource),
          usage: currentUsage,
          limit: planLimit.limit,
          unlimited: planLimit.limit === null,
          remaining: planLimit.limit === null ? null : Math.max(0, planLimit.limit - currentUsage),
        };
      })
    );

    return { metrics };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to fetch usage metrics");
  }
};

export const BillingService = {
  getCurrentWorkspaceSubscription,
  prepareCheckoutFlow,
  createCustomerPortal,
  getBillingHistory,
  getUsage,
};
