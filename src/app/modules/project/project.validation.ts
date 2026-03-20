import { z } from "zod";
import { ProjectStatus, TaskStatus } from "../../constants/task";

const projectIdParamSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Project ID must be a valid UUID"),
  }),
});

const createProjectSchema = z.object({
  body: z
    .object({
      name: z
        .string()
        .trim()
        .min(2, "Project name must be at least 2 characters")
        .max(150, "Project name cannot exceed 150 characters"),
      description: z
        .string()
        .trim()
        .max(5000, "Description cannot exceed 5000 characters")
        .optional(),
      clientName: z
        .string()
        .trim()
        .min(2, "Client name must be at least 2 characters")
        .max(150, "Client name cannot exceed 150 characters")
        .optional(),
      status: z.nativeEnum(ProjectStatus).optional(),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
    })
    .superRefine((data, ctx) => {
      if (data.startDate && data.endDate) {
        const start = new Date(data.startDate);
        const end = new Date(data.endDate);

        if (end < start) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["endDate"],
            message: "End date cannot be earlier than start date",
          });
        }
      }
    }),
});

const updateProjectSchema = z.object({
  body: z
    .object({
      name: z
        .string()
        .trim()
        .min(2, "Project name must be at least 2 characters")
        .max(150, "Project name cannot exceed 150 characters")
        .optional(),
      description: z
        .string()
        .trim()
        .max(5000, "Description cannot exceed 5000 characters")
        .nullable()
        .optional(),
      clientName: z
        .string()
        .trim()
        .min(2, "Client name must be at least 2 characters")
        .max(150, "Client name cannot exceed 150 characters")
        .nullable()
        .optional(),
      status: z.nativeEnum(ProjectStatus).optional(),
      startDate: z.string().datetime().nullable().optional(),
      endDate: z.string().datetime().nullable().optional(),
      archived: z.boolean().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field must be provided",
    })
    .superRefine((data, ctx) => {
      if (data.startDate && data.endDate) {
        const start = new Date(data.startDate);
        const end = new Date(data.endDate);

        if (end < start) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["endDate"],
            message: "End date cannot be earlier than start date",
          });
        }
      }
    }),
});

const getProjectsQuerySchema = z.object({
  query: z.object({
    searchTerm: z.string().trim().optional(),
    status: z.nativeEnum(ProjectStatus).optional(),
    clientName: z.string().trim().optional(),
    archived: z.enum(["true", "false"]).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    sortBy: z.enum(["name", "status", "createdAt", "updatedAt", "startDate", "endDate"]).optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  }),
});

const getProjectTasksQuerySchema = z.object({
  query: z.object({
    status: z.nativeEnum(TaskStatus).optional(),
    assignedToUserId: z.string().uuid("Assigned user ID must be a valid UUID").optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    sortBy: z.enum(["createdAt", "updatedAt", "dueDate", "title", "status"]).optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  }),
});

const assignProjectMembersSchema = z.object({
  body: z.object({
    userIds: z
      .array(z.string().uuid("Each user ID must be a valid UUID"))
      .min(1, "At least one user ID must be provided")
      .max(100, "You can assign up to 100 users at a time")
      .refine((userIds) => new Set(userIds).size === userIds.length, {
        message: "Duplicate user IDs are not allowed",
      }),
  }),
});

export const ProjectValidation = {
  projectIdParamSchema,
  createProjectSchema,
  updateProjectSchema,
  getProjectsQuerySchema,
  getProjectTasksQuerySchema,
  assignProjectMembersSchema,
};
