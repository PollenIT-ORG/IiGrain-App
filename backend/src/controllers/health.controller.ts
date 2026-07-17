import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import { checkConnection } from "../db/pool.js";
import env from "../config/env.js";

export const getHealth = asyncHandler(async (_req, res) => {
  const data = {
    status: "ok",
    service: "farmer-app-backend",
    environment: env.nodeEnv,
    uptime: `${Math.floor(process.uptime())}s`,
    timestamp: new Date().toISOString(),
  };

  return ApiResponse.send(res, 200, "Service is healthy", data);
});

export const getDbHealth = asyncHandler(async (_req, res) => {
  const startedAt = Date.now();
  await checkConnection();
  const latencyMs = Date.now() - startedAt;

  const data = {
    status: "ok",
    database: "postgresql",
    latency: `${latencyMs}ms`,
    timestamp: new Date().toISOString(),
  };

  return ApiResponse.send(res, 200, "Database is reachable", data);
});
