import { Prisma } from "../../generated/prisma/client";
import { AuditLogAction, AuditLogEntityType } from "../constants/auditLog";
import { prisma as defaultPrisma } from "../lib/prisma";

export interface IAuditLogInput {
  tx: Prisma.TransactionClient;
  workspaceId: string;
  actorUserId: string;
  action: AuditLogAction;
  entityType: AuditLogEntityType;
  entityId: string;
  entityTitle?: string;
  metadata?: Prisma.InputJsonValue | null;
}

export const auditLog = async (input: IAuditLogInput): Promise<void> => {
  try {
    await input.tx.activityLog.create({
      data: {
        workspaceId: input.workspaceId,
        userId: input.actorUserId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        entityTitle: input.entityTitle || null,
        metadata: input.metadata ?? Prisma.DbNull,
      } as any,
    });
  } catch (error) {
    console.error("[AuditLog Error]", error);
    throw error;
  }
};

export const auditLogStandalone = async (input: Omit<IAuditLogInput, "tx">): Promise<void> => {
  try {
    await defaultPrisma.activityLog.create({
      data: {
        workspaceId: input.workspaceId,
        userId: input.actorUserId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        entityTitle: input.entityTitle || null,
        metadata: input.metadata ?? Prisma.DbNull,
      } as any,
    });
  } catch (error) {
    console.error("[AuditLogStandalone Error]", error);
  }
};
