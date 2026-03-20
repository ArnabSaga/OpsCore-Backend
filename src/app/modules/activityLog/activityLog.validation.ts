import { z } from "zod";

const activityLogIdParamSchema = z.object({
  params: z.object({
    logId: z.string().uuid("Invalid activity log id"),
  }),
});

const getActivityLogsQuerySchema = z.object({
  query: z
    .object({
      page: z.coerce.number().int().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
      action: z.string().trim().min(1).max(100).optional(),
      entityType: z.string().trim().min(1).max(100).optional(),
      userId: z.string().uuid("Invalid user id").optional(),
      from: z.coerce.date().optional(),
      to: z.coerce.date().optional(),
    })
    .superRefine((value, ctx) => {
      if (value.from && value.to && value.from > value.to) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["from"],
          message: "`from` date must be earlier than or equal to `to` date",
        });
      }
    }),
});

export const ActivityLogValidation = {
  activityLogIdParamSchema,
  getActivityLogsQuerySchema,
};
