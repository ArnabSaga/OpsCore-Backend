import status from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import AppError from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import {
  NOTIFICATION_PREFERENCE_DEFAULTS,
  NotificationChannel,
  NotificationStatus,
  NotificationType,
} from "./notification.constants";
import {
  IMarkAllAsReadPayload,
  INotificationQuery,
  INotificationSummaryResponse,
  IUpdateNotificationPreferencePayload,
} from "./notification.interface";
import { generateActionUrl } from "./notification.utils";

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
  const where = {
    workspaceId,
    userId,
    status: NotificationStatus.UNREAD,
    archivedAt: null,
    deletedAt: null,
  };

  const totalUnread = await prisma.notification.count({ where });

  const unreadByType = await prisma.notification.groupBy({
    by: ["type"],
    where,
    _count: {
      type: true,
    },
  });

  return {
    totalUnread,
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

const getNotificationPreferencesFromDB = async (workspaceId: string, userId: string) => {
  let preference = await prisma.notificationPreference.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
  });

  if (!preference) {
    preference = await prisma.notificationPreference.create({
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
  // Ensure preference exists
  await getNotificationPreferencesFromDB(workspaceId, userId);

  return await prisma.notificationPreference.update({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
    data: payload,
  });
};

const createNotification = async (
  tx: Omit<
    Prisma.TransactionClient,
    "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
  >,
  data: {
    workspaceId: string;
    userId: string;
    type: string;
    title: string;
    message: string;
    channel?: NotificationChannel;
    entityType?: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
  }
) => {
  const preferences = await getNotificationPreferencesFromDB(data.workspaceId, data.userId);

  // Channel-aware preference guard
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
 * Domain-specific helper for Task Assignment
 */
const createTaskAssignedNotification = async (
  tx: Prisma.TransactionClient,
  data: {
    workspaceId: string;
    userId: string;
    taskId: string;
    taskTitle: string;
    assignerName: string;
  }
) => {
  const preferences = await getNotificationPreferencesFromDB(data.workspaceId, data.userId);
  if (!preferences.taskAssigned) return null;

  return await createNotification(tx, {
    workspaceId: data.workspaceId,
    userId: data.userId,
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
 * Domain-specific helper for Invitation Received
 */
const createInvitationNotification = async (
  tx: Prisma.TransactionClient,
  data: {
    workspaceId: string;
    userId: string;
    workspaceName: string;
    inviterName: string;
  }
) => {
  const preferences = await getNotificationPreferencesFromDB(data.workspaceId, data.userId);
  if (!preferences.invitationReceived) return null;

  return await createNotification(tx, {
    workspaceId: data.workspaceId,
    userId: data.userId,
    type: NotificationType.INVITATION_RECEIVED,
    title: "New Workspace Invitation",
    message: `${data.inviterName} invited you to join ${data.workspaceName}`,
    entityType: "INVITATION",
    entityId: data.workspaceId, // In this context, entityId is the workspace itself
    metadata: {
      workspaceName: data.workspaceName,
      inviterName: data.inviterName,
    },
  });
};

/**
 * Domain-specific helper for Invoice Overdue
 */
const createInvoiceNotification = async (
  tx: Prisma.TransactionClient,
  data: {
    workspaceId: string;
    userId: string;
    invoiceId: string;
    invoiceNumber: string;
    type: NotificationType;
  }
) => {
  const preferences = await getNotificationPreferencesFromDB(data.workspaceId, data.userId);

  // Guard based on type
  if (data.type === NotificationType.INVOICE_OVERDUE && !preferences.invoiceOverdue) return null;
  if (data.type === NotificationType.INVOICE_PAID && !preferences.invoicePaid) return null;
  if (data.type === NotificationType.INVOICE_SENT && !preferences.invoiceSent) return null;

  return await createNotification(tx, {
    workspaceId: data.workspaceId,
    userId: data.userId,
    type: data.type,
    title: `Invoice ${data.type.split("_")[1].toLowerCase()}`,
    message: `Invoice #${data.invoiceNumber} is ${data.type.split("_")[1].toLowerCase()}`,
    entityType: "INVOICE",
    entityId: data.invoiceId,
    metadata: {
      invoiceNumber: data.invoiceNumber,
    },
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
  createNotification,
  createTaskAssignedNotification,
  createInvitationNotification,
  createInvoiceNotification,
};
