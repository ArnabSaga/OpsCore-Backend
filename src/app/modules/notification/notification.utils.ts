import { NotificationEntityType } from "./notification.constants";

export const generateActionUrl = (
  entityType: string | null | undefined,
  entityId: string | null | undefined,
  workspaceId: string
): string | null => {
  if (!entityType || !entityId) return null;

  switch (entityType) {
    case NotificationEntityType.TASK:
      return `/dashboard/workspaces/${workspaceId}/tasks/${entityId}`;
    case NotificationEntityType.PROJECT:
      return `/dashboard/workspaces/${workspaceId}/projects/${entityId}`;
    case NotificationEntityType.INVOICE:
      return `/dashboard/workspaces/${workspaceId}/invoices/${entityId}`;
    case NotificationEntityType.INVITATION:
      return `/dashboard/workspaces/${workspaceId}`;
    case NotificationEntityType.WORKSPACE:
      return `/dashboard/workspaces/${workspaceId}`;
    case NotificationEntityType.SYSTEM:
      return "/dashboard";
    default:
      return null;
  }
};
