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

export const DashboardValidation = {
  getDashboardOverviewSchema,
  getDashboardActivitySchema,
};
