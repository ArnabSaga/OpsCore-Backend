import { z } from "zod";

const taskIdParamSchema = z.object({
  params: z.object({
    taskId: z.string().uuid("Task ID must be a valid UUID"),
  }),
});

const createTaskSchema = z.object({
  body: z.object({
    projectId: z.string().uuid("Project ID must be a valid UUID"),
    title: z
      .string()
      .trim()
      .min(2, "Task title must be at least 2 characters")
      .max(200, "Task title cannot exceed 200 characters"),
    description: z
      .string()
      .trim()
      .max(5000, "Description cannot exceed 5000 characters")
      .optional(),
    assignedToUserId: z
      .union([z.string().uuid("Assigned user ID must be a valid UUID"), z.null()])
      .optional(),
    status: z.enum(["TODO", "IN_PROGRESS", "REVIEW", "DONE"]).optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
    dueDate: z.string().datetime().optional(),
  }),
});

const updateTaskSchema = z.object({
  body: z
    .object({
      projectId: z.string().uuid("Project ID must be a valid UUID").optional(),
      title: z
        .string()
        .trim()
        .min(2, "Task title must be at least 2 characters")
        .max(200, "Task title cannot exceed 200 characters")
        .optional(),
      description: z
        .string()
        .trim()
        .max(5000, "Description cannot exceed 5000 characters")
        .nullable()
        .optional(),
      assignedToUserId: z
        .union([z.string().uuid("Assigned user ID must be a valid UUID"), z.null()])
        .optional(),
      status: z.enum(["TODO", "IN_PROGRESS", "REVIEW", "DONE"]).optional(),
      priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
      dueDate: z.string().datetime().nullable().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field must be provided",
    }),
});

const getTasksQuerySchema = z.object({
  query: z
    .object({
      searchTerm: z.string().trim().optional(),
      projectId: z.string().uuid("Project ID must be a valid UUID").optional(),
      assignedToUserId: z.string().uuid("Assigned user ID must be a valid UUID").optional(),
      assignedToMe: z.enum(["true", "false"]).optional(),
      status: z.enum(["TODO", "IN_PROGRESS", "REVIEW", "DONE"]).optional(),
      priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
      overdue: z.enum(["true", "false"]).optional(),
      dueFrom: z.string().datetime().optional(),
      dueTo: z.string().datetime().optional(),
      page: z.coerce.number().int().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
      sortBy: z
        .enum(["createdAt", "updatedAt", "dueDate", "title", "status", "priority"])
        .optional(),
      sortOrder: z.enum(["asc", "desc"]).optional(),
    })
    .superRefine((data, ctx) => {
      if (data.dueFrom && data.dueTo) {
        const dueFrom = new Date(data.dueFrom);
        const dueTo = new Date(data.dueTo);

        if (dueTo < dueFrom) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["dueTo"],
            message: "dueTo cannot be earlier than dueFrom",
          });
        }
      }
    }),
});

export const TaskValidation = {
  taskIdParamSchema,
  createTaskSchema,
  updateTaskSchema,
  getTasksQuerySchema,
};
