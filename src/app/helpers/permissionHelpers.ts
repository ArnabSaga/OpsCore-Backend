import status from "http-status";
import { WorkspaceMemberRole } from "../constants/role";
import AppError from "../errors/AppError";

export const assertWorkspaceRoleAllowed = (
  workspaceRole: WorkspaceMemberRole | string | undefined,
  allowedRoles: (WorkspaceMemberRole | string)[],
  errorMessage: string
) => {
  if (!workspaceRole) {
    throw new AppError(status.FORBIDDEN, "Workspace role is required. " + errorMessage);
  }

  const normalizedAllowedRoles = allowedRoles.map((role) => role.toUpperCase());
  const currentRole = workspaceRole.toUpperCase();

  if (!normalizedAllowedRoles.includes(currentRole)) {
    throw new AppError(status.FORBIDDEN, errorMessage);
  }
};
