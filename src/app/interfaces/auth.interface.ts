import {
  SystemRole,
  WorkspaceMemberRole,
  WorkspaceMemberStatus,
} from "../../generated/prisma/enums";

export interface TAuthenticatedUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  systemRole: SystemRole;
  isActive: boolean;
}

export interface TWorkspaceMembershipContext {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceMemberRole;
  status: WorkspaceMemberStatus;
}
