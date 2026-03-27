import { InvitationStatus, WorkspaceMemberRole } from "../../../generated/prisma/enums";
import { WorkspacePlan } from "../../config/planFeatures";

export interface ICreateInvitationPayload {
  email: string;
  role?: Exclude<WorkspaceMemberRole, "OWNER">;
}

export interface IInvitationPlanMeta {
  workspacePlan: WorkspacePlan;
  isTrialActive: boolean;
  trialStartsAt: Date | null;
  trialEndsAt: Date | null;
}

export interface IInvitationResponse {
  id: string;
  email: string;
  role: WorkspaceMemberRole;
  status: InvitationStatus;
  expiresAt: Date;
  createdAt: Date;
  acceptedAt?: Date | null;
  rejectedAt?: Date | null;
  canceledAt?: Date | null;
  invitedBy: {
    id: string;
    name: string;
    email: string;
  };
  planMeta?: IInvitationPlanMeta;
}

export interface IAcceptInvitationResponse {
  workspaceId: string;
  workspaceName: string;
}
