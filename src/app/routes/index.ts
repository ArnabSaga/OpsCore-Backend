import { Router } from "express";
import { ActivityLogRoutes } from "../modules/activityLog/activityLog.route";
import { AnalyticsRoutes } from "../modules/analytics/analytics.route";
import { AuthRoutes } from "../modules/auth/auth.route";
import { BillingRoutes } from "../modules/billing/billing.route";
import { DashboardRoutes } from "../modules/dashboard/dashboard.route";
import { HealthRoutes } from "../modules/health/health.route";
import {
  InvitationActionRoutes,
  InvitationWorkspaceRoutes,
} from "../modules/invitation/invitation.route";
import { InvoiceRoutes } from "../modules/invoice/invoice.route";
import { PlatformInvoiceRoutes } from "../modules/invoice/platform-invoice.route";
import { ProjectRoutes } from "../modules/project/project.route";
import { TaskRoutes } from "../modules/task/task.route";
import { UserRoutes, PlatformUserRoutes } from "../modules/user/user.route";
import { WorkspaceRoutes } from "../modules/workspace/workspace.route";
import { WorkspaceMemberRoutes } from "../modules/workspaceMember/workspaceMember.route";
import { NotificationRoutes } from "../modules/notification/notification.route";
import { PlatformSubscriptionRoutes } from "../modules/billing/platform-subscription.route";
import { PlatformActivityLogRoutes } from "../modules/activityLog/platform-activity-log.route";


type TModuleRoutes = {
  path: string;
  route: Router;
};

const router = Router();

const moduleRoutes: TModuleRoutes[] = [
  // Core
  { path: "/auth", route: AuthRoutes },
  { path: "/users", route: UserRoutes },

  // Platform Oversight
  { path: "/platform/invoices", route: PlatformInvoiceRoutes },
  { path: "/platform/subscriptions", route: PlatformSubscriptionRoutes },
  { path: "/platform/logs", route: PlatformActivityLogRoutes },
  { path: "/platform/users", route: PlatformUserRoutes },


  // Workspace
  { path: "/workspaces", route: WorkspaceRoutes },
  { path: "/workspaces/:workspaceId/members", route: WorkspaceMemberRoutes },
  { path: "/workspaces/:workspaceId/invitations", route: InvitationWorkspaceRoutes },

  // Core Features
  { path: "/projects", route: ProjectRoutes },
  { path: "/tasks", route: TaskRoutes },
  { path: "/invoices", route: InvoiceRoutes },
  { path: "/dashboard", route: DashboardRoutes },
  { path: "/activity-logs", route: ActivityLogRoutes },
  { path: "/analytics", route: AnalyticsRoutes },
  { path: "/health", route: HealthRoutes },
  { path: "/notifications", route: NotificationRoutes },

  // Billing
  { path: "/billing", route: BillingRoutes },

  // Public token actions
  { path: "/invitations", route: InvitationActionRoutes },
];


moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
