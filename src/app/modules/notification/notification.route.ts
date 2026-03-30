import { Router } from "express";
import { requireAuth } from "../../middlewares/requireAuth";
import { workspaceContext } from "../../middlewares/workspaceContext";
import validateRequest from "../../middlewares/validateRequest";
import { NotificationController } from "./notification.controller";
import { NotificationValidation } from "./notification.validation";

const router = Router();

router.use(requireAuth);
router.use(workspaceContext);

router.get(
  "/",
  validateRequest(NotificationValidation.getNotificationsQuerySchema),
  NotificationController.getNotifications
);

router.get("/unread-summary", NotificationController.getUnreadSummary);

router.patch(
  "/read-all",
  validateRequest(NotificationValidation.markAllNotificationsReadSchema),
  NotificationController.markAllNotificationsAsRead
);

router.get(
  "/preferences",
  NotificationController.getNotificationPreferences
);

router.patch(
  "/preferences",
  validateRequest(NotificationValidation.updateNotificationPreferencesSchema),
  NotificationController.updateNotificationPreferences
);

router.get(
  "/:notificationId",
  validateRequest(NotificationValidation.notificationIdParamSchema),
  NotificationController.getNotificationById
);

router.patch(
  "/:notificationId/read",
  validateRequest(NotificationValidation.notificationIdParamSchema),
  NotificationController.markNotificationAsRead
);

router.patch(
  "/:notificationId/unread",
  validateRequest(NotificationValidation.notificationIdParamSchema),
  NotificationController.markNotificationAsUnread
);

router.patch(
  "/:notificationId/archive",
  validateRequest(NotificationValidation.notificationIdParamSchema),
  NotificationController.archiveNotification
);

router.delete(
  "/:notificationId",
  validateRequest(NotificationValidation.notificationIdParamSchema),
  NotificationController.deleteNotification
);

export const NotificationRoutes = router;
