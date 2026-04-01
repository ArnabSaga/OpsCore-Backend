import { NotificationType, NotificationStatus, NotificationChannel, NotificationEntityType } from "./notification.constants";

export interface INotification {
  id: string;
  workspaceId: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  status: string;
  channel: string;
  entityType?: string | null;
  entityId?: string | null;
  actionUrl?: string | null;
  metadata?: Record<string, unknown> | null;
  readAt?: Date | null;
  archivedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export interface INotificationPreference {
  id: string;
  workspaceId: string;
  userId: string;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  taskAssigned: boolean;
  taskStatusChanged: boolean;
  taskCommentAdded: boolean;
  taskDueSoon: boolean;
  taskOverdue: boolean;
  invitationReceived: boolean;
  invitationAccepted: boolean;
  invoiceSent: boolean;
  invoicePaid: boolean;
  invoiceOverdue: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface INotificationQuery {
  page?: number;
  limit?: number;
  status?: NotificationStatus;
  type?: NotificationType;
  channel?: NotificationChannel;
  entityType?: NotificationEntityType;
  searchTerm?: string;
  sortBy?: "createdAt" | "readAt";
  sortOrder?: "asc" | "desc";
}

export interface IMarkAllAsReadPayload {
  type?: NotificationType;
  entityType?: NotificationEntityType;
  onlyUnread?: boolean;
}

export interface IUpdateNotificationPreferencePayload {
  inAppEnabled?: boolean;
  emailEnabled?: boolean;
  taskAssigned?: boolean;
  taskStatusChanged?: boolean;
  taskCommentAdded?: boolean;
  taskDueSoon?: boolean;
  taskOverdue?: boolean;
  invitationReceived?: boolean;
  invitationAccepted?: boolean;
  invoiceSent?: boolean;
  invoicePaid?: boolean;
  invoiceOverdue?: boolean;
}

export interface INotificationResponse extends INotification {
  // Add any extra fields if needed for the response
}

export interface INotificationSummaryResponse {
  totalUnread: number;
  totalArchived: number;
  totalActive: number; // Unread + Read
  byType: Array<{
    type: string;
    count: number;
  }>;
}
