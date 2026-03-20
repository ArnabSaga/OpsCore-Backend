import { WorkspaceMemberRole } from "../../generated/prisma/enums";
import { TAuthenticatedUser, TWorkspaceMembershipContext } from "../interfaces/auth.interface";

declare global {
  namespace Express {
    interface Request {
      user?: TAuthenticatedUser;
      workspaceId?: string;
      workspaceRole?: WorkspaceMemberRole;
      workspaceMembership?: TWorkspaceMembershipContext;
    }
  }
}

export {};
