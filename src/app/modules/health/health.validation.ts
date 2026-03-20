import { z } from "zod";

const emptyRequestSchema = z.object({
  body: z.object({}).strict().optional(),
  query: z.object({}).strict().optional(),
  params: z.object({}).strict().optional(),
});

export const HealthValidation = {
  getHealthSchema: emptyRequestSchema,
  getDatabaseHealthSchema: emptyRequestSchema,
  getReadinessSchema: emptyRequestSchema,
};
