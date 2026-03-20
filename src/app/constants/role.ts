import {
  SystemRole,
  WorkspaceMemberRole,
  WorkspaceMemberStatus,
} from "../../generated/prisma/enums";

export { SystemRole, WorkspaceMemberRole, WorkspaceMemberStatus };

export const WORKSPACE_MANAGEMENT_ROLES = [
  WorkspaceMemberRole.OWNER,
  WorkspaceMemberRole.ADMIN,
] as const;

export const ALL_WORKSPACE_ROLES = [
  WorkspaceMemberRole.OWNER,
  WorkspaceMemberRole.ADMIN,
  WorkspaceMemberRole.MEMBER,
] as const;

export const ACTIVE_WORKSPACE_MEMBER_STATUSES = [WorkspaceMemberStatus.ACTIVE] as const;

export const NON_OWNER_WORKSPACE_ROLES = [
  WorkspaceMemberRole.ADMIN,
  WorkspaceMemberRole.MEMBER,
] as const;
