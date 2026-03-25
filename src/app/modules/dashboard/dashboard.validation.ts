import { z } from "zod";

const getDashboardOverviewSchema = z.object({
  query: z.object({}).strict().optional(),
});

const getDashboardActivitySchema = z.object({
  query: z
    .object({
      page: z.coerce.number().int().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(50).optional(),
    })
    .strict(),
});

const getDashboardMetricsSchema = z.object({
  query: z
    .object({
      period: z
        .enum(["last_7_days", "last_30_days", "last_3_months", "last_12_months"])
        .optional(),
    })
    .strict(),
});

export const DashboardValidation = {
  getDashboardOverviewSchema,
  getDashboardActivitySchema,
  getDashboardMetricsSchema,
};
