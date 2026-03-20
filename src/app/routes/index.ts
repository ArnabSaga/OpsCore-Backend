import { Router } from "express";
import { AuthRoutes } from "../modules/auth/auth.route";
import { BillingRoutes } from "../modules/billing/billing.route";
import { DashboardRoutes } from "../modules/dashboard/dashboard.route";
import {
  InvitationActionRoutes,
  InvitationWorkspaceRoutes,
} from "../modules/invitation/invitation.route";
import { InvoiceRoutes } from "../modules/invoice/invoice.route";
import { ProjectRoutes } from "../modules/project/project.route";
import { TaskRoutes } from "../modules/task/task.route";
import { UserRoutes } from "../modules/user/user.route";
import { WorkspaceRoutes } from "../modules/workspace/workspace.route";
import { WorkspaceMemberRoutes } from "../modules/workspaceMember/workspaceMember.route";

type TModuleRoutes = {
  path: string;
  route: Router;
};

const router = Router();

const moduleRoutes: TModuleRoutes[] = [
  // Core
  { path: "/auth", route: AuthRoutes },
  { path: "/account", route: UserRoutes },

  // Workspace
  { path: "/workspaces", route: WorkspaceRoutes },
  { path: "/workspaces/:workspaceId/members", route: WorkspaceMemberRoutes },
  { path: "/workspaces/:workspaceId/invitations", route: InvitationWorkspaceRoutes },

  // Core Features
  { path: "/projects", route: ProjectRoutes },
  { path: "/tasks", route: TaskRoutes },
  { path: "/invoices", route: InvoiceRoutes },
  { path: "/dashboard", route: DashboardRoutes },

  // Billing
  { path: "/billing", route: BillingRoutes },

  // Public token actions
  { path: "/invitations", route: InvitationActionRoutes },
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
