import { prisma } from "../lib/prisma";

export interface IAuditLogInput {
  workspaceId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: any;
}

export const auditLog = async (input: IAuditLogInput): Promise<void> => {
  try {
    await prisma.activityLog.create({
      data: {
        workspaceId: input.workspaceId,
        userId: input.userId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata ?? null,
      },
    });
  } catch (error) {
    console.error("[AuditLog Error]", error);
  }
};
