import {
  SystemRole,
  WorkspaceMemberRole,
  WorkspaceMemberStatus,
} from "../../../generated/prisma/enums";

export interface IUpdateProfilePayload {
  name?: string;
  image?: string;
}

export interface IProfileWorkspaceMember {
  role: WorkspaceMemberRole;
  status: WorkspaceMemberStatus;
  workspace: {
    id: string;
    name: string;
    slug: string;
  };
}

export interface IProfileResponse {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  systemRole: SystemRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  workspaceMembers: IProfileWorkspaceMember[];
}
