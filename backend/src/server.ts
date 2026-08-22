import type { Server } from "node:http";
import app from "./app.js";
import env from "./config/env.js";
import logger from "./utils/logger.js";
import pool, { checkConnection } from "./db/pool.js";
import prisma from "./db/prisma.js";
import { runMigrations } from "./db/sync.js";
import { runSeed } from "./db/seed.js";
import {
  seedProgramAdminGlobalTemplate,
  seedGlobalContractTemplate,
} from "./db/seedProgramAdminGlobal.js";
import { initSocket } from "./socket/index.js";
import { runVisitMaintenance } from "./services/visit.service.js";
import "./config/cloudinary.js";

const VISIT_MAINTENANCE_INTERVAL_MS = 15 * 60 * 1000;

// Periodic housekeeping: close abandoned visits and prune old location history.
// A missed run is harmless - the next one catches up - so failures only log.
function startVisitMaintenance(): void {
  const run = (): void => {
    void runVisitMaintenance().catch((err) =>
      logger.error("Visit maintenance failed", err)
    );
  };
  run();
  setInterval(run, VISIT_MAINTENANCE_INTERVAL_MS).unref();
}

async function connectWithRetry(attempts = 5, delayMs = 3000): Promise<void> {
  for (let i = 1; i <= attempts; i++) {
    try {
      await checkConnection();
      return;
    } catch (err) {
      if (i === attempts) throw err;
      logger.warn(
        `Database not reachable (attempt ${i}/${attempts}) - retrying in ${delayMs}ms...`
      );
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

async function start(): Promise<void> {
  try {
    await connectWithRetry();
    logger.info("✅ Database connection established");

    if (env.dbSync) {
      await runMigrations();
    }
    if (env.dbSeed) {
      await runSeed();
    }

    // The Program Admin Survey module needs its shared "Global" survey template
    // and contract to exist. Both are idempotent (a no-op once seeded), so this
    // runs on every boot and no manual step is needed after a deploy. Failures
    // here (e.g. migrations not applied yet) must never stop the server.
    try {
      const [survey, contract] = await Promise.all([
        seedProgramAdminGlobalTemplate(),
        seedGlobalContractTemplate(),
      ]);
      if (survey.created) logger.info("✅ Seeded the global survey template");
      if (contract.created) logger.info("✅ Seeded the global contract");
    } catch (err) {
      logger.warn("Could not ensure the Program Admin global templates", err);
    }

    const server = app.listen(env.port, () => {
      logger.info(
        `🚜 Farmer App backend running in ${env.nodeEnv} mode on port ${env.port}`
      );
      logger.info(
        `   Health check: http://localhost:${env.port}${env.apiPrefix}/health`
      );
      logger.info(
        `   Server running on : http://localhost:${env.port}${env.apiPrefix}`
      );
    });

    initSocket(server);
    startVisitMaintenance();

    setupGracefulShutdown(server);
  } catch (err) {
    logger.error("❌ Failed to start server", err);
    process.exit(1);
  }
}

function setupGracefulShutdown(server: Server): void {
  const shutdown = (signal: string): void => {
    logger.info(`${signal} received - shutting down gracefully...`);

    server.close(async () => {
      logger.info("HTTP server closed.");
      try {
        await prisma.$disconnect();
        logger.info("Prisma client disconnected.");
        await pool.end();
        logger.info("Database pool closed.");
        process.exit(0);
      } catch (err) {
        logger.error("Error during shutdown", err);
        process.exit(1);
      }
    });

    setTimeout(() => {
      logger.error("Forced shutdown after timeout.");
      process.exit(1);
    }, 10000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled Promise Rejection", reason);
  });
  process.on("uncaughtException", (err) => {
    logger.error("Uncaught Exception", err);
    process.exit(1);
  });
}

void start();
