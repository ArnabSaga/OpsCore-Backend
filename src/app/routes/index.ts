import { Router } from "express";
import { AuthRoutes } from "../modules/auth/auth.route";
import { InvitationRoutes } from "../modules/invitation/invitation.route";
import { ProjectRoutes } from "../modules/project/project.routes";
import { UserRoutes } from "../modules/user/user.route";
import { WorkspaceRoutes } from "../modules/workspace/workspace.route";

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
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
