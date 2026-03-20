import { Router } from "express";
import { WorkspaceMemberRole } from "../../constants/role";
import { requireAuth } from "../../middlewares/requireAuth";
import { requireFeature } from "../../middlewares/requireFeature";
import { requireRole } from "../../middlewares/requireRole";
import validateRequest from "../../middlewares/validateRequest";
import { workspaceContext } from "../../middlewares/workspaceContext";
import { uploadTaskAttachment } from "../../uploads/task/uploadTaskAttachment";
import { TaskController } from "./task.controller";
import { TaskValidation } from "./task.validation";

const router = Router();

router.use(requireAuth);
router.use(workspaceContext);

router.get("/", validateRequest(TaskValidation.getTasksQuerySchema), TaskController.getTasks);

router.post(
  "/",
  requireFeature("tasks.create"),
  requireRole(WorkspaceMemberRole.OWNER, WorkspaceMemberRole.ADMIN),
  validateRequest(TaskValidation.createTaskSchema),
  TaskController.createTask
);

router.get("/:taskId", validateRequest(TaskValidation.taskIdParamSchema), TaskController.getTask);

router.patch(
  "/:taskId",
  validateRequest(TaskValidation.taskIdParamSchema),
  validateRequest(TaskValidation.updateTaskSchema),
  TaskController.updateTask
);

router.delete(
  "/:taskId",
  validateRequest(TaskValidation.taskIdParamSchema),
  requireRole(WorkspaceMemberRole.OWNER, WorkspaceMemberRole.ADMIN),
  TaskController.deleteTask
);

router.get(
  "/:taskId/comments",
  validateRequest(TaskValidation.taskIdParamSchema),
  validateRequest(TaskValidation.getTaskCommentsQuerySchema),
  TaskController.getTaskComments
);

router.post(
  "/:taskId/comments",
  requireFeature("tasks.comments"),
  validateRequest(TaskValidation.taskIdParamSchema),
  validateRequest(TaskValidation.createTaskCommentSchema),
  TaskController.createTaskComment
);

router.patch(
  "/:taskId/comments/:commentId",
  requireFeature("tasks.comments"),
  validateRequest(TaskValidation.taskCommentParamsSchema),
  validateRequest(TaskValidation.updateTaskCommentSchema),
  TaskController.updateTaskComment
);

router.delete(
  "/:taskId/comments/:commentId",
  requireFeature("tasks.comments"),
  validateRequest(TaskValidation.taskCommentParamsSchema),
  TaskController.deleteTaskComment
);

router.get(
  "/:taskId/attachments",
  validateRequest(TaskValidation.taskIdParamSchema),
  validateRequest(TaskValidation.getTaskAttachmentsQuerySchema),
  TaskController.getTaskAttachments
);

router.post(
  "/:taskId/attachments",
  requireFeature("tasks.attachments"),
  validateRequest(TaskValidation.taskIdParamSchema),
  uploadTaskAttachment.single("file"),
  TaskController.uploadTaskAttachment
);

router.delete(
  "/:taskId/attachments/:attachmentId",
  requireFeature("tasks.attachments"),
  validateRequest(TaskValidation.taskAttachmentParamsSchema),
  TaskController.deleteTaskAttachment
);

export const TaskRoutes = router;
