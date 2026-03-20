
import { Prisma } from '../../generated/prisma/client';
import { prisma } from "../lib/prisma";

type ActivityLogDbClient = Prisma.TransactionClient | typeof prisma;

type LogActivityInput = {
  workspaceId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
};

export const logActivity = async (
  { workspaceId, userId, action, entityType, entityId = null, metadata }: LogActivityInput,
  dbClient: ActivityLogDbClient = prisma
) => {
  return dbClient.activityLog.create({
    data: {
      workspaceId,
      userId,
      action,
      entityType,
      entityId: entityId ?? null,
      metadata: metadata ?? Prisma.JsonNull,
    },
  });
};

export const logActivitySafely = async (
  input: LogActivityInput,
  dbClient: ActivityLogDbClient = prisma
) => {
  try {
    await logActivity(input, dbClient);
  } catch (error) {
    console.error("Failed to persist activity log:", error);
  }
};
