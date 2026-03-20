export interface IBaseHealthResponse {
  status: "ok" | "degraded" | "ready" | "not_ready";
  service: string;
  timestamp: string;
  uptimeSeconds: number;
  environment: string;
}

export interface IHealthResponse extends IBaseHealthResponse {
  message: string;
}

export interface IDatabaseHealthResponse extends IBaseHealthResponse {
  database: {
    status: "connected" | "disconnected";
    latencyMs: number | null;
  };
}

export interface IReadyHealthResponse extends IBaseHealthResponse {
  checks: {
    database: boolean;
  };
}
