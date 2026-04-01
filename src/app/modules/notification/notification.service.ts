import status from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import AppError from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import {
  NOTIFICATION_PREFERENCE_DEFAULTS,
  NotificationChannel,
  NotificationStatus,
  NotificationType,
  NotificationEntityType,
} from "./notification.constants";
import {
  IMarkAllAsReadPayload,
  INotificationQuery,
  INotificationSummaryResponse,
  IUpdateNotificationPreferencePayload,
} from "./notification.interface";
import { generateActionUrl } from "./notification.utils";

type PrismaTx = Omit<
  Prisma.TransactionClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

const getNotificationsFromDB = async (
  workspaceId: string,
  userId: string,
  query: INotificationQuery
) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 100);
  const skip = (page - 1) * limit;
  const sortBy = query.sortBy || "createdAt";
  const sortOrder = query.sortOrder || "desc";

  const where: Prisma.NotificationWhereInput = {
    workspaceId,
    userId,
    deletedAt: null,
  };

  // Default: Exclude Archived unless explicitly requested
  if (query.status) {
    where.status = query.status;
  } else {
    where.status = { not: NotificationStatus.ARCHIVED };
    where.archivedAt = null;
  }

  if (query.type) where.type = query.type;
  if (query.channel) where.channel = query.channel;
  if (query.entityType) where.entityType = query.entityType;
  if (query.searchTerm) {
    where.OR = [
      { title: { contains: query.searchTerm, mode: "insensitive" } },
      { message: { contains: query.searchTerm, mode: "insensitive" } },
    ];
  }

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
    }),
    prisma.notification.count({ where }),
  ]);

  return {
    data: notifications,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

const getUnreadSummaryFromDB = async (
  workspaceId: string,
  userId: string
): Promise<INotificationSummaryResponse> => {
  const baseWhere = {
    workspaceId,
    userId,
    deletedAt: null,
  };

  const [totalUnread, totalArchived, totalActive, unreadByType] = await Promise.all([
    prisma.notification.count({
      where: { ...baseWhere, status: NotificationStatus.UNREAD, archivedAt: null },
    }),
    prisma.notification.count({
      where: { ...baseWhere, status: NotificationStatus.ARCHIVED },
    }),
    prisma.notification.count({
      where: { ...baseWhere, archivedAt: null }, // Both READ and UNREAD
    }),
    prisma.notification.groupBy({
      by: ["type"],
      where: { ...baseWhere, status: NotificationStatus.UNREAD, archivedAt: null },
      _count: {
        type: true,
      },
    }),
  ]);

  return {
    totalUnread,
    totalArchived,
    totalActive,
    byType: unreadByType.map((group) => ({
      type: group.type,
      count: group._count.type,
    })),
  };
};

const getNotificationByIdFromDB = async (
  workspaceId: string,
  userId: string,
  notificationId: string
) => {
  const notification = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      workspaceId,
      userId,
      deletedAt: null,
    },
  });

  if (!notification) {
    throw new AppError(status.NOT_FOUND, "Notification not found");
  }

  return notification;
};

const markNotificationAsReadIntoDB = async (
  workspaceId: string,
  userId: string,
  notificationId: string
) => {
  const notification = await getNotificationByIdFromDB(workspaceId, userId, notificationId);

  // Idempotent check
  if (notification.status === NotificationStatus.READ) {
    return notification;
  }

  return await prisma.notification.update({
    where: { id: notificationId },
    data: {
      status: NotificationStatus.READ,
      readAt: new Date(),
    },
  });
};

const markNotificationAsUnreadIntoDB = async (
  workspaceId: string,
  userId: string,
  notificationId: string
) => {
  const notification = await getNotificationByIdFromDB(workspaceId, userId, notificationId);

  // Idempotent check
  if (notification.status === NotificationStatus.UNREAD) {
    return notification;
  }

  return await prisma.notification.update({
    where: { id: notificationId },
    data: {
      status: NotificationStatus.UNREAD,
      readAt: null,
      archivedAt: null,
    },
  });
};

const markAllNotificationsAsReadIntoDB = async (
  workspaceId: string,
  userId: string,
  payload: IMarkAllAsReadPayload
) => {
  const where: Prisma.NotificationWhereInput = {
    workspaceId,
    userId,
    deletedAt: null,
  };

  // Honor onlyUnread (default true)
  const onlyUnread = payload.onlyUnread !== false;
  if (onlyUnread) {
    where.status = NotificationStatus.UNREAD;
  }

  if (payload.type) where.type = payload.type;
  if (payload.entityType) where.entityType = payload.entityType;

  return await prisma.notification.updateMany({
    where,
    data: {
      status: NotificationStatus.READ,
      readAt: new Date(),
    },
  });
};

const archiveNotificationIntoDB = async (
  workspaceId: string,
  userId: string,
  notificationId: string
) => {
  const notification = await getNotificationByIdFromDB(workspaceId, userId, notificationId);

  // Idempotent check
  if (notification.status === NotificationStatus.ARCHIVED) {
    return notification;
  }

  return await prisma.notification.update({
    where: { id: notificationId },
    data: {
      status: NotificationStatus.ARCHIVED,
      archivedAt: new Date(),
    },
  });
};

const deleteNotificationFromDB = async (
  workspaceId: string,
  userId: string,
  notificationId: string
) => {
  await getNotificationByIdFromDB(workspaceId, userId, notificationId);

  return await prisma.notification.update({
    where: { id: notificationId },
    data: { deletedAt: new Date() },
  });
};

const getNotificationPreferencesFromDB = async (
  workspaceId: string,
  userId: string,
  tx?: PrismaTx
) => {
  const client = tx || prisma;
  let preference = await client.notificationPreference.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
  });

  if (!preference) {
    preference = await client.notificationPreference.create({
      data: {
        workspaceId,
        userId,
        ...NOTIFICATION_PREFERENCE_DEFAULTS,
      },
    });
  }

  return preference;
};

const updateNotificationPreferencesIntoDB = async (
  workspaceId: string,
  userId: string,
  payload: IUpdateNotificationPreferencePayload
) => {
  // Use root prisma here since this is usually a standalone action
  return await prisma.$transaction(async (tx) => {
    await getNotificationPreferencesFromDB(workspaceId, userId, tx);

    return await tx.notificationPreference.update({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
      data: payload,
    });
  });
};

const createNotification = async (
  tx: PrismaTx,
  data: {
    workspaceId: string;
    userId: string;
    actorUserId: string;
    type: string;
    title: string;
    message: string;
    channel?: NotificationChannel;
    entityType?: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
  }
) => {
  // 1. Self-suppression logic
  if (data.userId === data.actorUserId) return null;

  // 2. Preference lookup (in-app enabled by default)
  const preferences = await getNotificationPreferencesFromDB(data.workspaceId, data.userId, tx);

  const channel = data.channel || NotificationChannel.IN_APP;
  if (channel === NotificationChannel.IN_APP && !preferences.inAppEnabled) return null;
  if (channel === NotificationChannel.EMAIL && !preferences.emailEnabled) return null;

  const actionUrl = generateActionUrl(data.entityType, data.entityId, data.workspaceId);

  return await tx.notification.create({
    data: {
      workspaceId: data.workspaceId,
      userId: data.userId,
      type: data.type,
      title: data.title,
      message: data.message,
      channel: data.channel || NotificationChannel.IN_APP,
      entityType: data.entityType,
      entityId: data.entityId,
      actionUrl,
      metadata: (data.metadata || {}) as Prisma.InputJsonValue,
    },
  });
};

/**
 * Helper to handle bulk notifications with unique recipients and suppression
 */
const createBulkNotifications = async (
  tx: PrismaTx,
  data: {
    workspaceId: string;
    actorUserId: string;
    recipientUserIds: string[];
    type: string;
    title: string;
    message: string;
    entityType?: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
  }
) => {
  const uniqueRecipients = Array.from(new Set(data.recipientUserIds)).filter(
    (id) => id !== data.actorUserId
  );

  return await Promise.all(
    uniqueRecipients.map((userId) =>
      createNotification(tx, {
        ...data,
        userId,
      })
    )
  );
};

/**
 * Domain-specific helper for Task Assignment
 */
const createTaskAssignedNotification = async (
  tx: PrismaTx,
  data: {
    workspaceId: string;
    userId: string;
    actorUserId: string;
    taskId: string;
    taskTitle: string;
    assignerName: string;
  }
) => {
  const preferences = await getNotificationPreferencesFromDB(data.workspaceId, data.userId, tx);
  if (!preferences.taskAssigned) return null;

  return await createNotification(tx, {
    workspaceId: data.workspaceId,
    userId: data.userId,
    actorUserId: data.actorUserId,
    type: NotificationType.TASK_ASSIGNED,
    title: "New Task Assigned",
    message: `${data.assignerName} assigned you a new task: ${data.taskTitle}`,
    entityType: "TASK",
    entityId: data.taskId,
    metadata: {
      taskTitle: data.taskTitle,
      assignerName: data.assignerName,
    },
  });
};

/**
 * Domain-specific helper for Task Comments
 */
const createTaskCommentNotification = async (
  tx: PrismaTx,
  data: {
    workspaceId: string;
    userId: string;
    actorUserId: string;
    taskId: string;
    taskTitle: string;
    commenterName: string;
  }
) => {
  const preferences = await getNotificationPreferencesFromDB(data.workspaceId, data.userId, tx);
  if (!preferences.taskCommentAdded) return null;

  return await createNotification(tx, {
    workspaceId: data.workspaceId,
    userId: data.userId,
    actorUserId: data.actorUserId,
    type: NotificationType.TASK_COMMENT_ADDED,
    title: "New Task Comment",
    message: `${data.commenterName} commented on task: ${data.taskTitle}`,
    entityType: "TASK",
    entityId: data.taskId,
    metadata: {
      taskTitle: data.taskTitle,
      commenterName: data.commenterName,
    },
  });
};

/**
 * Domain-specific helper for Invitation Received
 */
const createInvitationReceivedNotification = async (
  tx: PrismaTx,
  data: {
    workspaceId: string;
    userId: string;
    actorUserId: string;
    workspaceName: string;
    inviterName: string;
  }
) => {
  const preferences = await getNotificationPreferencesFromDB(data.workspaceId, data.userId, tx);
  if (!preferences.invitationReceived) return null;

  return await createNotification(tx, {
    workspaceId: data.workspaceId,
    userId: data.userId,
    actorUserId: data.actorUserId,
    type: NotificationType.INVITATION_RECEIVED,
    title: "New Workspace Invitation",
    message: `${data.inviterName} invited you to join ${data.workspaceName}`,
    entityType: "INVITATION",
    entityId: data.workspaceId,
    metadata: {
      workspaceName: data.workspaceName,
      inviterName: data.inviterName,
    },
  });
};

/**
 * Domain-specific helper for Invitation Accepted
 */
const createInvitationAcceptedNotification = async (
  tx: PrismaTx,
  data: {
    workspaceId: string;
    userId: string;
    actorUserId: string;
    workspaceName: string;
    accepterName: string;
  }
) => {
  const preferences = await getNotificationPreferencesFromDB(data.workspaceId, data.userId, tx);
  if (!preferences.invitationAccepted) return null;

  return await createNotification(tx, {
    workspaceId: data.workspaceId,
    userId: data.userId,
    actorUserId: data.actorUserId,
    type: NotificationType.INVITATION_ACCEPTED,
    title: "Invitation Accepted",
    message: `${data.accepterName} has joined your workspace: ${data.workspaceName}`,
    entityType: "WORKSPACE",
    entityId: data.workspaceId,
    metadata: {
      workspaceName: data.workspaceName,
      accepterName: data.accepterName,
    },
  });
};

/**
 * Domain-specific helper for Invoice Sent
 */
const createInvoiceSentNotification = async (
  tx: PrismaTx,
  data: {
    workspaceId: string;
    recipientUserIds: string[];
    actorUserId: string;
    invoiceId: string;
    invoiceNumber: string;
    workspaceName: string;
  }
) => {
  return await createBulkNotifications(tx, {
    workspaceId: data.workspaceId,
    actorUserId: data.actorUserId,
    recipientUserIds: data.recipientUserIds,
    type: NotificationType.INVOICE_SENT,
    title: "Invoice Sent",
    message: `Invoice #${data.invoiceNumber} has been sent for ${data.workspaceName}`,
    entityType: "INVOICE",
    entityId: data.invoiceId,
    metadata: {
      invoiceNumber: data.invoiceNumber,
      workspaceName: data.workspaceName,
    },
  });
};

/**
 * Domain-specific helper for Invoice Paid
 */
const createInvoicePaidNotification = async (
  tx: PrismaTx,
  data: {
    workspaceId: string;
    recipientUserIds: string[];
    actorUserId: string;
    invoiceId: string;
    invoiceNumber: string;
    workspaceName: string;
  }
) => {
  return await createBulkNotifications(tx, {
    workspaceId: data.workspaceId,
    actorUserId: data.actorUserId,
    recipientUserIds: data.recipientUserIds,
    type: NotificationType.INVOICE_PAID,
    title: "Invoice Paid",
    message: `Invoice #${data.invoiceNumber} has been paid for ${data.workspaceName}`,
    entityType: "INVOICE",
    entityId: data.invoiceId,
    metadata: {
      invoiceNumber: data.invoiceNumber,
      workspaceName: data.workspaceName,
    },
  });
};

/**
 * Domain-specific helper for Invoice Overdue
 */
const createInvoiceOverdueNotification = async (
  tx: PrismaTx,
  data: {
    workspaceId: string;
    userId: string;
    actorUserId: string;
    invoiceId: string;
    invoiceNumber: string;
  }
) => {
  const preferences = await getNotificationPreferencesFromDB(data.workspaceId, data.userId, tx);
  if (!preferences.invoiceOverdue) return null;

  return await createNotification(tx, {
    workspaceId: data.workspaceId,
    userId: data.userId,
    actorUserId: data.actorUserId,
    type: NotificationType.INVOICE_OVERDUE,
    title: "Invoice Overdue",
    message: `Invoice #${data.invoiceNumber} is overdue`,
    entityType: "INVOICE",
    entityId: data.invoiceId,
    metadata: {
      invoiceNumber: data.invoiceNumber,
    },
  });
};

const triggerDemoNotificationIntoDB = async (
  workspaceId: string,
  userId: string
) => {
  return await prisma.$transaction(async (tx) => {
    return await createNotification(tx, {
      workspaceId,
      userId,
      actorUserId: "system-demo-bot", // Bypass self-suppression for demo
      type: NotificationType.SYSTEM_ANNOUNCEMENT,
      title: "Welcome to OpsCore Notifications!",
      message: "This is a demo notification to confirm your system is correctly fetching and displaying notifications. You can mark this as read or archive it.",
      entityType: NotificationEntityType.SYSTEM,
      entityId: "demo",
    });
  });
};

export const NotificationService = {
  getNotificationsFromDB,
  getUnreadSummaryFromDB,
  getNotificationByIdFromDB,
  markNotificationAsReadIntoDB,
  markNotificationAsUnreadIntoDB,
  markAllNotificationsAsReadIntoDB,
  archiveNotificationIntoDB,
  deleteNotificationFromDB,
  getNotificationPreferencesFromDB,
  updateNotificationPreferencesIntoDB,
  triggerDemoNotificationIntoDB,
  createNotification,
  createBulkNotifications,
  createTaskAssignedNotification,
  createTaskCommentNotification,
  createInvitationReceivedNotification,
  createInvitationAcceptedNotification,
  createInvoiceSentNotification,
  createInvoicePaidNotification,
  createInvoiceOverdueNotification,
};
