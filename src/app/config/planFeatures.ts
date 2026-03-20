import { SubscriptionPlan } from "../constants/subscription";

export type WorkspacePlan = SubscriptionPlan;

export type PlanFeatureKey =
  | "workspace.multiWorkspace"
  | "workspace.customBranding"
  | "workspace.advancedPermissions"
  | "workspace.memberManagement"
  | "projects.create"
  | "projects.archive"
  | "projects.assignMembers"
  | "tasks.create"
  | "tasks.comments"
  | "tasks.attachments"
  | "tasks.advancedFilters"
  | "invoices.create"
  | "invoices.send"
  | "billing.customerPortal"
  | "billing.checkout"
  | "dashboard.overview"
  | "dashboard.activity"
  | "analytics.projects"
  | "analytics.revenue"
  | "activityLogs.read"
  | "activityLogs.export"
  | "automation.basic"
  | "automation.advanced"
  | "notifications.email"
  | "api.webhooks"
  | "support.priority";

export type PlanLimitKey =
  | "workspaces"
  | "members"
  | "projects"
  | "tasks"
  | "taskCommentsPerTask"
  | "taskAttachmentsPerTask"
  | "storageMb"
  | "monthlyInvitations"
  | "monthlyInvoices";

export type RateLimitActionKey =
  | "auth.login"
  | "auth.register"
  | "auth.passwordReset"
  | "invitations.create"
  | "tasks.write"
  | "projects.write"
  | "search.global"
  | "webhooks.receive";

export interface RateLimitPolicy {
  windowMs: number;
  max: number;
}

export interface TrialPolicy {
  enabled: boolean;
  durationDays: number;
  temporaryPlan: WorkspacePlan | null;
}

export interface PlanPolicy {
  flags: Record<PlanFeatureKey, boolean>;
  limits: Record<PlanLimitKey, number | null>;
  rateLimits: Record<RateLimitActionKey, RateLimitPolicy>;
  trial: TrialPolicy;
}

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

export const UNLIMITED = null;

export const PLAN_FEATURES: Record<WorkspacePlan, PlanPolicy> = {
  FREE: {
    flags: {
      "workspace.multiWorkspace": false,
      "workspace.customBranding": false,
      "workspace.advancedPermissions": false,
      "workspace.memberManagement": true,

      "projects.create": true,
      "projects.archive": false,
      "projects.assignMembers": true,

      "tasks.create": true,
      "tasks.comments": true,
      "tasks.attachments": false,
      "tasks.advancedFilters": false,

      "invoices.create": true,
      "invoices.send": false,

      "billing.customerPortal": false,
      "billing.checkout": true,

      "dashboard.overview": true,
      "dashboard.activity": false,

      "analytics.projects": false,
      "analytics.revenue": false,

      "activityLogs.read": false,
      "activityLogs.export": false,

      "automation.basic": false,
      "automation.advanced": false,

      "notifications.email": true,
      "api.webhooks": false,
      "support.priority": false,
    },
    limits: {
      workspaces: 1,
      members: 5,
      projects: 3,
      tasks: 100,
      taskCommentsPerTask: 50,
      taskAttachmentsPerTask: 0,
      storageMb: 250,
      monthlyInvitations: 25,
      monthlyInvoices: 10,
    },
    rateLimits: {
      "auth.login": { windowMs: 15 * MINUTE, max: 20 },
      "auth.register": { windowMs: HOUR, max: 10 },
      "auth.passwordReset": { windowMs: HOUR, max: 5 },
      "invitations.create": { windowMs: HOUR, max: 20 },
      "tasks.write": { windowMs: HOUR, max: 300 },
      "projects.write": { windowMs: HOUR, max: 60 },
      "search.global": { windowMs: MINUTE, max: 60 },
      "webhooks.receive": { windowMs: MINUTE, max: 120 },
    },
    trial: {
      enabled: true,
      durationDays: 14,
      temporaryPlan: "PRO",
    },
  },

  PRO: {
    flags: {
      "workspace.multiWorkspace": true,
      "workspace.customBranding": true,
      "workspace.advancedPermissions": true,
      "workspace.memberManagement": true,

      "projects.create": true,
      "projects.archive": true,
      "projects.assignMembers": true,

      "tasks.create": true,
      "tasks.comments": true,
      "tasks.attachments": true,
      "tasks.advancedFilters": true,

      "invoices.create": true,
      "invoices.send": true,

      "billing.customerPortal": true,
      "billing.checkout": true,

      "dashboard.overview": true,
      "dashboard.activity": true,

      "analytics.projects": true,
      "analytics.revenue": false,

      "activityLogs.read": true,
      "activityLogs.export": false,

      "automation.basic": true,
      "automation.advanced": false,

      "notifications.email": true,
      "api.webhooks": false,
      "support.priority": false,
    },
    limits: {
      workspaces: 5,
      members: 25,
      projects: 50,
      tasks: 5000,
      taskCommentsPerTask: 1000,
      taskAttachmentsPerTask: 25,
      storageMb: 10_000,
      monthlyInvitations: 500,
      monthlyInvoices: 1000,
    },
    rateLimits: {
      "auth.login": { windowMs: 15 * MINUTE, max: 50 },
      "auth.register": { windowMs: HOUR, max: 20 },
      "auth.passwordReset": { windowMs: HOUR, max: 10 },
      "invitations.create": { windowMs: HOUR, max: 100 },
      "tasks.write": { windowMs: HOUR, max: 1500 },
      "projects.write": { windowMs: HOUR, max: 250 },
      "search.global": { windowMs: MINUTE, max: 200 },
      "webhooks.receive": { windowMs: MINUTE, max: 300 },
    },
    trial: {
      enabled: false,
      durationDays: 0,
      temporaryPlan: null,
    },
  },

  ENTERPRISE: {
    flags: {
      "workspace.multiWorkspace": true,
      "workspace.customBranding": true,
      "workspace.advancedPermissions": true,
      "workspace.memberManagement": true,

      "projects.create": true,
      "projects.archive": true,
      "projects.assignMembers": true,

      "tasks.create": true,
      "tasks.comments": true,
      "tasks.attachments": true,
      "tasks.advancedFilters": true,

      "invoices.create": true,
      "invoices.send": true,

      "billing.customerPortal": true,
      "billing.checkout": true,

      "dashboard.overview": true,
      "dashboard.activity": true,

      "analytics.projects": true,
      "analytics.revenue": true,

      "activityLogs.read": true,
      "activityLogs.export": true,

      "automation.basic": true,
      "automation.advanced": true,

      "notifications.email": true,
      "api.webhooks": true,
      "support.priority": true,
    },
    limits: {
      workspaces: UNLIMITED,
      members: UNLIMITED,
      projects: UNLIMITED,
      tasks: UNLIMITED,
      taskCommentsPerTask: UNLIMITED,
      taskAttachmentsPerTask: UNLIMITED,
      storageMb: UNLIMITED,
      monthlyInvitations: UNLIMITED,
      monthlyInvoices: UNLIMITED,
    },
    rateLimits: {
      "auth.login": { windowMs: 15 * MINUTE, max: 100 },
      "auth.register": { windowMs: HOUR, max: 50 },
      "auth.passwordReset": { windowMs: HOUR, max: 20 },
      "invitations.create": { windowMs: HOUR, max: 500 },
      "tasks.write": { windowMs: HOUR, max: 5000 },
      "projects.write": { windowMs: HOUR, max: 1000 },
      "search.global": { windowMs: MINUTE, max: 1000 },
      "webhooks.receive": { windowMs: MINUTE, max: 2000 },
    },
    trial: {
      enabled: false,
      durationDays: 0,
      temporaryPlan: null,
    },
  },
};

export const DEFAULT_WORKSPACE_PLAN: WorkspacePlan = "FREE";

export const WORKSPACE_PLAN_RANK: Record<WorkspacePlan, number> = {
  FREE: 1,
  PRO: 2,
  ENTERPRISE: 3,
};

export const compareWorkspacePlans = (a: WorkspacePlan, b: WorkspacePlan) => {
  return WORKSPACE_PLAN_RANK[a] - WORKSPACE_PLAN_RANK[b];
};

export const getHigherWorkspacePlan = (a: WorkspacePlan, b: WorkspacePlan): WorkspacePlan => {
  return compareWorkspacePlans(a, b) >= 0 ? a : b;
};

export const isKnownWorkspacePlan = (value: string): value is WorkspacePlan => {
  return Object.values(SubscriptionPlan).includes(value as SubscriptionPlan);
};

export const isKnownFeatureKey = (value: string): value is PlanFeatureKey => {
  return value in PLAN_FEATURES.FREE.flags;
};

export const isKnownLimitKey = (value: string): value is PlanLimitKey => {
  return value in PLAN_FEATURES.FREE.limits;
};

export const isKnownRateLimitActionKey = (value: string): value is RateLimitActionKey => {
  return value in PLAN_FEATURES.FREE.rateLimits;
};
