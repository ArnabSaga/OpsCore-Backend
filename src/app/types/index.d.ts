import { TAuthenticatedUser, TWorkspaceMembershipContext } from "../../app/interfaces/auth";

declare global {
  namespace Express {
    interface Request {
      user?: TAuthenticatedUser;
      workspaceId?: string;
      workspaceRole?: string;
      workspaceMembership?: TWorkspaceMembershipContext;
    }
  }
}

export {};
