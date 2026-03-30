export const NotificationStatus = {
  UNREAD: "UNREAD",
  READ: "READ",
  ARCHIVED: "ARCHIVED",
} as const;

export type NotificationStatus = (typeof NotificationStatus)[keyof typeof NotificationStatus];

export const NotificationChannel = {
  IN_APP: "IN_APP",
  EMAIL: "EMAIL",
} as const;

export type NotificationChannel = (typeof NotificationChannel)[keyof typeof NotificationChannel];

export const NotificationEntityType = {
  WORKSPACE: "WORKSPACE",
  PROJECT: "PROJECT",
  TASK: "TASK",
  INVOICE: "INVOICE",
  INVITATION: "INVITATION",
  SYSTEM: "SYSTEM",
} as const;

export type NotificationEntityType = (typeof NotificationEntityType)[keyof typeof NotificationEntityType];

export const NotificationType = {
  INVITATION_RECEIVED: "INVITATION_RECEIVED",
  INVITATION_ACCEPTED: "INVITATION_ACCEPTED",
  INVITATION_DECLINED: "INVITATION_DECLINED",
  WORKSPACE_MEMBER_ROLE_CHANGED: "WORKSPACE_MEMBER_ROLE_CHANGED",
  PROJECT_MEMBER_ADDED: "PROJECT_MEMBER_ADDED",
  PROJECT_ARCHIVED: "PROJECT_ARCHIVED",
  TASK_ASSIGNED: "TASK_ASSIGNED",
  TASK_UPDATED: "TASK_UPDATED",
  TASK_STATUS_CHANGED: "TASK_STATUS_CHANGED",
  TASK_COMMENT_ADDED: "TASK_COMMENT_ADDED",
  TASK_DUE_SOON: "TASK_DUE_SOON",
  TASK_OVERDUE: "TASK_OVERDUE",
  INVOICE_CREATED: "INVOICE_CREATED",
  INVOICE_SENT: "INVOICE_SENT",
  INVOICE_PAID: "INVOICE_PAID",
  INVOICE_OVERDUE: "INVOICE_OVERDUE",
  SYSTEM_ANNOUNCEMENT: "SYSTEM_ANNOUNCEMENT",
} as const;

export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

export const NOTIFICATION_PREFERENCE_DEFAULTS = {
  inAppEnabled: true,
  emailEnabled: false,
  taskAssigned: true,
  taskStatusChanged: true,
  taskCommentAdded: true,
  taskDueSoon: true,
  taskOverdue: true,
  invitationReceived: true,
  invitationAccepted: true,
  invoiceSent: true,
  invoicePaid: true,
  invoiceOverdue: true,
};
