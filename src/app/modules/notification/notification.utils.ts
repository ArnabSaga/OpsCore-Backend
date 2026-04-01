import { NotificationEntityType } from "./notification.constants";

export const generateActionUrl = (
  entityType: string | null | undefined,
  entityId: string | null | undefined,
  workspaceId: string
): string | null => {
  if (!entityType || !entityId) return null;

  switch (entityType) {
    case NotificationEntityType.TASK:
      return `/dashboard/tasks/${entityId}`;
    case NotificationEntityType.PROJECT:
      return `/dashboard/projects/${entityId}`;
    case NotificationEntityType.INVOICE:
      return `/dashboard/invoices/${entityId}`;
    case NotificationEntityType.INVITATION:
    case NotificationEntityType.WORKSPACE:
      return `/dashboard/workspaces/${workspaceId}/members`;
    case NotificationEntityType.SYSTEM:
      return "/dashboard";
    default:
      return null;
  }
};
