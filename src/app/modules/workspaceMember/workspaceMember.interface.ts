import { WorkspaceMemberRole, WorkspaceMemberStatus } from "../../../generated/prisma/enums";

export interface IWorkspaceMemberRouteParams {
  workspaceId: string;
}

export interface IWorkspaceMemberMutationParams extends IWorkspaceMemberRouteParams {
  memberId: string;
}

export interface IUpdateWorkspaceMemberPayload {
  role?: WorkspaceMemberRole;
  status?: WorkspaceMemberStatus;
}

export interface IWorkspaceMemberUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
}

export interface IWorkspaceMemberResponse {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceMemberRole;
  status: WorkspaceMemberStatus;
  joinedAt: Date;
  addedByUserId: string | null;
  addedByUser?: IWorkspaceMemberUser | null;
  isCurrentUser: boolean;
  user: IWorkspaceMemberUser;
}

export interface IWorkspaceMemberListResponse {
  members: IWorkspaceMemberResponse[];
}
