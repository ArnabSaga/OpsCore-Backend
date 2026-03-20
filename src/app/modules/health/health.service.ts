import status from "http-status";
import { prisma } from "../../lib/prisma";
import { envVars } from "../../config/env";
import { IDatabaseHealthResponse, IHealthResponse, IReadyHealthResponse } from "./health.interface";

const getBasePayload = () => {
  return {
    service: "OpsCore API",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: envVars.NODE_ENV,
  };
};

const getHealth = async (): Promise<IHealthResponse> => {
  return {
    ...getBasePayload(),
    status: "ok",
    message: "API server is healthy",
  };
};

const getDatabaseHealth = async (): Promise<{
  statusCode: number;
  payload: IDatabaseHealthResponse;
}> => {
  const startedAt = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;

    return {
      statusCode: status.OK,
      payload: {
        ...getBasePayload(),
        status: "ok",
        database: {
          status: "connected",
          latencyMs: Date.now() - startedAt,
        },
      },
    };
  } catch {
    return {
      statusCode: status.SERVICE_UNAVAILABLE,
      payload: {
        ...getBasePayload(),
        status: "degraded",
        database: {
          status: "disconnected",
          latencyMs: null,
        },
      },
    };
  }
};

const getReadiness = async (): Promise<{
  statusCode: number;
  payload: IReadyHealthResponse;
}> => {
  let databaseReady = false;

  try {
    await prisma.$queryRaw`SELECT 1`;
    databaseReady = true;
  } catch {
    databaseReady = false;
  }

  const isReady = databaseReady;

  return {
    statusCode: isReady ? status.OK : status.SERVICE_UNAVAILABLE,
    payload: {
      ...getBasePayload(),
      status: isReady ? "ready" : "not_ready",
      checks: {
        database: databaseReady,
      },
    },
  };
};

export const HealthService = {
  getHealth,
  getDatabaseHealth,
  getReadiness,
};
