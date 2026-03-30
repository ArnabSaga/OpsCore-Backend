import { z } from "zod";
import { NotificationType, NotificationStatus, NotificationChannel, NotificationEntityType } from "./notification.constants";

const notificationIdParamSchema = z.object({
  params: z.object({
    notificationId: z.string().uuid("Notification ID must be a valid UUID"),
  }),
});

const getNotificationsQuerySchema = z.object({
  query: z.object({
    searchTerm: z.string().trim().optional(),
    status: z.nativeEnum(NotificationStatus).optional(),
    channel: z.nativeEnum(NotificationChannel).optional(),
    entityType: z.nativeEnum(NotificationEntityType).optional(),
    type: z.nativeEnum(NotificationType).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    sortBy: z.enum(["createdAt", "readAt"]).optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  }),
});

const updateNotificationPreferencesSchema = z.object({
  body: z
    .object({
      inAppEnabled: z.boolean().optional(),
      emailEnabled: z.boolean().optional(),
      taskAssigned: z.boolean().optional(),
      taskStatusChanged: z.boolean().optional(),
      taskCommentAdded: z.boolean().optional(),
      taskDueSoon: z.boolean().optional(),
      taskOverdue: z.boolean().optional(),
      invitationReceived: z.boolean().optional(),
      invitationAccepted: z.boolean().optional(),
      invoiceSent: z.boolean().optional(),
      invoicePaid: z.boolean().optional(),
      invoiceOverdue: z.boolean().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one preference field must be provided",
    }),
});

const markAllNotificationsReadSchema = z.object({
  body: z
    .object({
      type: z.nativeEnum(NotificationType).optional(),
      entityType: z.nativeEnum(NotificationEntityType).optional(),
      onlyUnread: z.boolean().optional(),
    })
    .optional(),
});

export const NotificationValidation = {
  notificationIdParamSchema,
  getNotificationsQuerySchema,
  updateNotificationPreferencesSchema,
  markAllNotificationsReadSchema,
};
