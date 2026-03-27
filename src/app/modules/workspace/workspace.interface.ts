import { WorkspaceMemberRole, WorkspaceMemberStatus } from "../../../generated/prisma/enums";
import { WorkspacePlan } from "../../config/planFeatures";

export interface ICreateWorkspacePayload {
  name: string;
}

export interface IUpdateWorkspacePayload {
  name?: string;
}

export interface IUpdateMemberPayload {
  role?: WorkspaceMemberRole;
  status?: WorkspaceMemberStatus;
}

export interface IUpdateGeneralSettingsPayload {
  name?: string;
  description?: string | null;
  timezone?: string | null;
  currency?: string | null;
  supportEmail?: string | null;
  billingEmail?: string | null;
}

export interface IUpdateBrandingPayload {
  logoUrl?: string | null;
  faviconUrl?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
  customDomain?: string | null;
  emailBrandName?: string | null;
}

export interface IWorkspacePlanMeta {
  basePlan: WorkspacePlan;
  effectivePlan: WorkspacePlan;
  isTrialActive: boolean;
  trialStartsAt: Date | null;
  trialEndsAt: Date | null;
}

export interface IWorkspaceResponse {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string;
  _count?: { members: number };
  planMeta?: IWorkspacePlanMeta;
}

export interface IMyWorkspaceResponse extends IWorkspaceResponse {
  role: WorkspaceMemberRole;
  status: WorkspaceMemberStatus;
  isActiveWorkspace: boolean;
}

export interface IEnhancedWorkspaceResponse extends IWorkspaceResponse {
  role: WorkspaceMemberRole | null;
  status: WorkspaceMemberStatus | null;
  isActiveWorkspace: boolean;
  counts: {
    members: number;
    activeMembers: number;
    invitations: number;
    pendingInvitations: number;
    projects: number;
    tasks: number;
  };
  permissions: import("./workspace.capabilities").IWorkspaceCapabilities | null;
  createdBy?: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
}

export interface IWorkspaceMemberResponse {
  id: string;
  role: WorkspaceMemberRole;
  status: WorkspaceMemberStatus;
  joinedAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
}

export interface ISwitchWorkspaceParams {
  workspaceId: string;
}

export interface ISwitchWorkspaceResponse {
  workspaceId: string;
  workspaceName: string;
  role: WorkspaceMemberRole;
}
