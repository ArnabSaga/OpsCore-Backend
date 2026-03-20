import { ProjectStatus, TaskPriority, TaskStatus } from "../../generated/prisma/enums";

export { ProjectStatus, TaskPriority, TaskStatus };

export const OPEN_TASK_STATUSES = [
  TaskStatus.TODO,
  TaskStatus.IN_PROGRESS,
  TaskStatus.REVIEW,
] as const;

export const CLOSED_TASK_STATUSES = [TaskStatus.DONE] as const;

export const ACTIVE_PROJECT_STATUSES = [
  ProjectStatus.ACTIVE,
  ProjectStatus.ON_HOLD,
  ProjectStatus.COMPLETED,
] as const;

export const WRITABLE_PROJECT_STATUSES = [ProjectStatus.ACTIVE, ProjectStatus.ON_HOLD] as const;

export const TASK_DEFAULTS = {
  status: TaskStatus.TODO,
  priority: TaskPriority.MEDIUM,
} as const;
