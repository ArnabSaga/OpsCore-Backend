import { z } from "zod";

const getProjectsAnalyticsSchema = z.object({
  query: z
    .object({
      from: z.coerce.date().optional(),
      to: z.coerce.date().optional(),
      limit: z.coerce.number().int().min(1).max(20).optional(),
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

const getRevenueAnalyticsSchema = z.object({
  query: z
    .object({
      from: z.coerce.date().optional(),
      to: z.coerce.date().optional(),
      currency: z.string().trim().min(3).max(10).optional(),
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

export const AnalyticsValidation = {
  getProjectsAnalyticsSchema,
  getRevenueAnalyticsSchema,
};
