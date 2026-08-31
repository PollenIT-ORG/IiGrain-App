import { io, type Socket } from "socket.io-client";
import { API_BASE_URL } from "../config/apiConfig";
import { TOKEN_KEY } from "./api";

function socketOrigin(): string {
  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    return API_BASE_URL.replace(/\/api\/v\d+\/?$/, "");
  }
}

let socket: Socket | null = null;

/**
 * Visit rooms this tab wants to be in. Rooms are per socket connection, so
 * they must be re-joined after every reconnect.
 */

const rooms = new Set<string>();

function attachLifecycle(s: Socket): void {
  s.on("connect", () => {
    rooms.forEach((visitId) => s.emit("visit:join", { visitId }));
  });
}

export function getSocket(): Socket {
  if (socket) return socket;
  socket = io(socketOrigin(), {
    path: "/socket.io",
    auth: { token: localStorage.getItem(TOKEN_KEY) ?? "" },
    // Websocket first, polling as a fallback rather than not at all — a
    // corporate proxy that blocks websockets would otherwise leave the admin
    // with no realtime at all instead of a slower one.
    transports: ["websocket", "polling"],
    autoConnect: true,
  });
  attachLifecycle(socket);
  return socket;
}

/** Idempotent: safe to call for every visit on every render. */
export function joinVisitRoom(visitId: string): void {
  if (rooms.has(visitId)) return;
  rooms.add(visitId);
  socket?.emit("visit:join", { visitId });
}

export function leaveVisitRoom(visitId: string): void {
  rooms.delete(visitId);
}

export function closeSocket(): void {
  rooms.clear();
  socket?.close();
  socket = null;
}
