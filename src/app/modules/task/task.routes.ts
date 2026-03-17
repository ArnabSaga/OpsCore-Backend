import { Router } from "express";
import { WorkspaceMemberRole } from "../../../generated/prisma/enums";
import { requireAuth } from "../../middlewares/requireAuth";
import { requireRole } from "../../middlewares/requireRole";
import validateRequest from "../../middlewares/validateRequest";
import { workspaceContext } from "../../middlewares/workspaceContext";
import { TaskController } from "./task.controller";
import { TaskValidation } from "./task.validation";

const router = Router();

router.use(requireAuth);
router.use(workspaceContext);

router.get("/", validateRequest(TaskValidation.getTasksQuerySchema), TaskController.getTasks);

router.post(
  "/",
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

export const TaskRoutes = router;
