import type { Server as HttpServer } from "node:http";
import { Server as SocketServer, type Socket } from "socket.io";
import env from "../config/env.js";
import logger from "../utils/logger.js";
import { verifyToken, verifyWebsiteToken } from "../utils/jwt.js";
import { registerVisitHandlers } from "./visit.socket.js";
import { registerNotificationHandlers } from "./notification.socket.js";
import { findSubmissionByStatusToken } from "../models/eligibility.model.js";

export interface SocketUser {
  id: string;
  email: string;
  role: string;
}

export interface SocketWebsiteUser {
  id: string;
  email: string;
}

declare module "socket.io" {
  interface SocketData {
    user?: SocketUser;
    websiteUser?: SocketWebsiteUser;
    // The standalone survey app connects with only a magic-link status token.
    submissionId?: string;
  }
}

function statusTokenFrom(socket: Socket): string | null {
  const t = socket.handshake.auth?.statusToken;
  return typeof t === "string" && /^[a-f0-9]{32,64}$/i.test(t) ? t : null;
}

let io: SocketServer | null = null;

export function getIO(): SocketServer {
  if (!io) throw new Error("Socket.io has not been initialized.");
  return io;
}

function extractToken(socket: Socket): string | null {
  const fromAuth = socket.handshake.auth?.token;
  if (typeof fromAuth === "string" && fromAuth) {
    return fromAuth.replace(/^Bearer\s+/i, "");
  }
  const header = socket.handshake.headers?.authorization;
  if (typeof header === "string" && header) {
    return header.replace(/^Bearer\s+/i, "");
  }
  return null;
}

export function initSocket(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    path: "/socket.io",
    cors: {
      origin: env.corsOrigin === "*" ? true : env.corsOrigin.split(","),
      credentials: true,
    },
  });

  io.use((socket, next) => {
    // The standalone survey app has no account - it connects with the magic-link
    // status token, which we resolve to the submission it belongs to.
    const statusToken = statusTokenFrom(socket);
    if (statusToken) {
      void findSubmissionByStatusToken(statusToken)
        .then((submission) => {
          if (!submission) return next(new Error("Invalid status link."));
          socket.data.submissionId = submission.id;
          next();
        })
        .catch(() => next(new Error("Invalid status link.")));
      return;
    }

    const token = extractToken(socket);
    if (!token) return next(new Error("Authentication required."));

    // App users and website accounts both connect here. They are separate
    // audiences, so try each token kind and keep them in separate rooms.
    try {
      const payload = verifyToken(token);
      socket.data.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      };
      return next();
    } catch {
      // Not an app token - fall through and try the website one.
    }

    try {
      const payload = verifyWebsiteToken(token);
      socket.data.websiteUser = { id: payload.sub, email: payload.email };
      return next();
    } catch {
      return next(new Error("Invalid or expired token."));
    }
  });

  io.on("connection", (socket) => {
    const { user, websiteUser, submissionId } = socket.data;

    if (submissionId) {
      void socket.join(`submission:${submissionId}`);
      logger.info(`🔌 socket connected: standalone submission ${submissionId}`);
      socket.on("disconnect", (reason) => {
        logger.info(
          `🔌 socket disconnected: standalone submission ${submissionId} (${reason})`
        );
      });
      return;
    }

    if (websiteUser) {
      void socket.join(`website:${websiteUser.id}`);
      logger.info(`🔌 socket connected: ${websiteUser.email} (website)`);
      socket.on("disconnect", (reason) => {
        logger.info(
          `🔌 socket disconnected: ${websiteUser.email} (website, ${reason})`
        );
      });
      return;
    }

    if (!user) return;

    void socket.join(`user:${user.id}`);
    logger.info(`🔌 socket connected: ${user.email} (${user.role})`);

    registerVisitHandlers(io as SocketServer, socket);
    registerNotificationHandlers(io as SocketServer, socket);

    socket.on("disconnect", (reason) => {
      logger.info(`🔌 socket disconnected: ${user.email} (${reason})`);
    });
  });

  logger.info("🔌 Socket.io initialized at /socket.io");
  return io;
}
