import { InvitationStatus, WorkspaceMemberRole } from "../../../generated/prisma/enums";

export interface ICreateInvitationPayload {
  email: string;
  role?: Exclude<WorkspaceMemberRole, "OWNER">;
}

export interface IInvitationResponse {
  id: string;
  email: string;
  role: WorkspaceMemberRole;
  status: InvitationStatus;
  expiresAt: Date;
  createdAt: Date;
  invitedBy: {
    id: string;
    name: string;
    email: string;
  };
}

export interface IAcceptInvitationResponse {
  workspaceId: string;
  workspaceName: string;
}
