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
 * Visit rooms this tab wants to be in.
 *
 * Server-side rooms belong to a socket CONNECTION, not to a user: when the
 * socket drops and reconnects it comes back in no rooms at all. The board used
 * to track "already joined" in a component ref, so after any reconnect — a wifi
 * blip, a laptop waking, a backend deploy — it saw the ids as already joined and
 * never re-emitted. `data:changed` kept working (the server re-joins admins to
 * the "admins" room on every connection), so the list still refreshed when a
 * visit started or ended, but `visit:location` never arrived again: the dots
 * froze for the rest of the session while everything else looked healthy.
 *
 * Keeping the set here, next to the socket it describes, means the reconnect
 * handler can put us back in every room.
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
