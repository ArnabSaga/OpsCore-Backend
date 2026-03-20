import { Request } from "express";
import status from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import AppError from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import {
  IActivityLogItem,
  IActivityLogListResponse,
  IActivityLogQuery,
} from "./activityLog.interface";

const sanitizeMetadata = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const sensitiveKeyPattern =
    /(email|token|secret|password|authorization|cookie|api.?key|fileUrl|url)/i;

  const sanitizeValue = (input: unknown): unknown => {
    if (input === null) return null;

    if (Array.isArray(input)) {
      return input.slice(0, 20).map(sanitizeValue);
    }

    if (typeof input === "object") {
      const output: Record<string, unknown> = {};

      for (const [key, val] of Object.entries(input as Record<string, unknown>)) {
        if (sensitiveKeyPattern.test(key)) {
          output[key] = "[REDACTED]";
          continue;
        }

        output[key] = sanitizeValue(val);
      }

      return output;
    }

    if (typeof input === "string" && input.length > 500) {
      return `${input.slice(0, 500)}…`;
    }

    return input;
  };

  return sanitizeValue(value) as Record<string, unknown>;
};

const mapActivityLog = (row: {
  id: string;
  workspaceId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: unknown;
  createdAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
}): IActivityLogItem => {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    userId: row.userId,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId ?? null,
    metadata: sanitizeMetadata(row.metadata),
    createdAt: row.createdAt,
    user: {
      id: row.user.id,
      name: row.user.name,
      email: row.user.email,
      image: row.user.image,
    },
  };
};

const buildWhereClause = (
  workspaceId: string,
  query: IActivityLogQuery
): Prisma.ActivityLogWhereInput => {
  const where: Prisma.ActivityLogWhereInput = {
    workspaceId,
  };

  if (query.action) {
    where.action = {
      contains: query.action,
      mode: "insensitive",
    };
  }

  if (query.entityType) {
    where.entityType = {
      contains: query.entityType,
      mode: "insensitive",
    };
  }

  if (query.userId) {
    where.userId = query.userId;
  }

  if (query.from || query.to) {
    where.createdAt = {
      ...(query.from ? { gte: query.from } : {}),
      ...(query.to ? { lte: query.to } : {}),
    };
  }

  return where;
};

const getActivityLogs = async (
  req: Request,
  query: IActivityLogQuery
): Promise<IActivityLogListResponse> => {
  if (!req.user || !req.workspaceId || !req.workspaceRole) {
    throw new AppError(status.UNAUTHORIZED, "Authentication is required");
  }

  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 100);
  const skip = (page - 1) * limit;

  const where = buildWhereClause(req.workspaceId, query);

  const [rows, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        workspaceId: true,
        userId: true,
        action: true,
        entityType: true,
        entityId: true,
        metadata: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    }),
    prisma.activityLog.count({ where }),
  ]);

  return {
    data: rows.map(mapActivityLog),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

const getActivityLog = async (req: Request): Promise<IActivityLogItem> => {
  if (!req.user || !req.workspaceId || !req.workspaceRole) {
    throw new AppError(status.UNAUTHORIZED, "Authentication is required");
  }

  const logId = req.params.logId as string;

  const row = await prisma.activityLog.findUnique({
    where: {
      id: logId,
    },
    select: {
      id: true,
      workspaceId: true,
      userId: true,
      action: true,
      entityType: true,
      entityId: true,
      metadata: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    },
  });

  if (!row || row.workspaceId !== req.workspaceId) {
    throw new AppError(status.NOT_FOUND, "Activity log not found");
  }

  return mapActivityLog(row);
};

export const ActivityLogService = {
  getActivityLogs,
  getActivityLog,
};
