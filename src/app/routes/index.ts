import { Router } from "express";
import { AuthRoutes } from "../modules/auth/auth.route";
import { InvitationRoutes } from "../modules/invitation/invitation.route";
import { ProjectRoutes } from "../modules/project/project.routes";
import { TaskRoutes } from "../modules/task/task.routes";
import { UserRoutes } from "../modules/user/user.route";
import { WorkspaceRoutes } from "../modules/workspace/workspace.route";
import { WorkspaceMemberRoutes } from '../modules/workspaceMember/workspaceMember.route';

type TModuleRoutes = {
  path: string;
  route: Router;
};

const router = Router();

const moduleRoutes: TModuleRoutes[] = [
  { path: "/auth", route: AuthRoutes },
  { path: "/account", route: UserRoutes },
  { path: "/workspaces", route: WorkspaceRoutes },
  { path: "/invitations", route: InvitationRoutes },
  { path: "/projects", route: ProjectRoutes },
  { path: "/tasks", route: TaskRoutes },
  { path: "/workspace-members", route: WorkspaceMemberRoutes },
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
