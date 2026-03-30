import { NotificationEntityType } from "./notification.constants";

export const generateActionUrl = (
  entityType: string | null | undefined,
  entityId: string | null | undefined,
  workspaceId: string
): string | null => {
  if (!entityType || !entityId) return null;

  switch (entityType) {
    case NotificationEntityType.TASK:
      return `/workspaces/${workspaceId}/tasks/${entityId}`;
    case NotificationEntityType.PROJECT:
      return `/workspaces/${workspaceId}/projects/${entityId}`;
    case NotificationEntityType.INVOICE:
      return `/workspaces/${workspaceId}/invoices/${entityId}`;
    case NotificationEntityType.INVITATION:
      return `/workspaces/${workspaceId}`;
    case NotificationEntityType.WORKSPACE:
      return `/workspaces/${workspaceId}`;
    case NotificationEntityType.SYSTEM:
      return "/dashboard";
    default:
      return null;
  }
};
