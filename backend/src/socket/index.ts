import type { Server as HttpServer } from "node:http";
import { Server as SocketServer, type Socket } from "socket.io";
import env from "../config/env.js";
import logger from "../utils/logger.js";
import { verifyToken } from "../utils/jwt.js";
import { registerVisitHandlers } from "./visit.socket.js";
import { registerNotificationHandlers } from "./notification.socket.js";

export interface SocketUser {
  id: string;
  email: string;
  role: string;
}

declare module "socket.io" {
  interface SocketData {
    user: SocketUser;
  }
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
    try {
      const token = extractToken(socket);
      if (!token) return next(new Error("Authentication required."));
      const payload = verifyToken(token);
      socket.data.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      };
      next();
    } catch {
      next(new Error("Invalid or expired token."));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.data.user;
    void socket.join(`user:${user.id}`);
    logger.info(`socket connected: ${user.email} (${user.role})`);

    registerVisitHandlers(io as SocketServer, socket);
    registerNotificationHandlers(io as SocketServer, socket);

    socket.on("disconnect", (reason) => {
      logger.info(`socket disconnected: ${user.email} (${reason})`);
    });
  });

  logger.info("Socket.io initialized at /socket.io");
  return io;
}
