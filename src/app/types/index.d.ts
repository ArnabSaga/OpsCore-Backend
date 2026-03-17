import { TAuthenticatedUser, TWorkspaceMembershipContext } from "../interfaces/auth.interface";

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
