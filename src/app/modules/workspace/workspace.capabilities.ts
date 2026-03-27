import { WorkspaceMemberRole } from "../../../generated/prisma/enums";

export interface IWorkspaceCapabilities {
  canViewMembers: boolean;
  canManageMembers: boolean;
  canViewInvitations: boolean;
  canManageInvitations: boolean;
  canManageBilling: boolean;
  canUpdateWorkspace: boolean;
  canDeleteWorkspace: boolean;
  canManageBranding: boolean;
  canManagePermissions: boolean;
}

export const ROLE_CAPABILITIES: Record<WorkspaceMemberRole, string[]> = {
  OWNER: [
    "workspace.update",
    "workspace.delete",
    "members.manage",
    "invitations.manage",
    "billing.manage",
    "branding.manage",
    "permissions.manage",
  ],
  ADMIN: [
    "workspace.update",
    "members.manage",
    "invitations.manage",
    "branding.manage",
  ],
  MEMBER: ["projects.viewAssigned", "tasks.updateAssigned"],
};

export const resolveCapabilities = (
  role: WorkspaceMemberRole,
  isOwner?: boolean
): IWorkspaceCapabilities => {
  const caps = ROLE_CAPABILITIES[role] || [];
  
  return {
    canViewMembers: true, // Everyone can view members
    canManageMembers: caps.includes("members.manage"),
    canViewInvitations: true, // Everyone can view invitations
    canManageInvitations: caps.includes("invitations.manage"),
    canManageBilling: caps.includes("billing.manage") || isOwner === true,
    canUpdateWorkspace: caps.includes("workspace.update"),
    canDeleteWorkspace: caps.includes("workspace.delete") || isOwner === true,
    canManageBranding: caps.includes("branding.manage"),
    canManagePermissions: caps.includes("permissions.manage") || isOwner === true,
  };
};
