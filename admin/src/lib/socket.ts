import { io, type Socket } from "socket.io-client";
import { API_BASE_URL } from "../config/apiConfig";
import { TOKEN_KEY, getRefreshToken, refreshAccessToken } from "./api";

function socketOrigin(): string {
  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    return API_BASE_URL.replace(/\/api\/v\d+\/?$/, "");
  }
}

let socket: Socket | null = null;
let detach: (() => void) | null = null;

/**
 * Visit rooms this tab wants to be in. Rooms are per socket connection, so
 * they must be re-joined after every reconnect.
 */

const rooms = new Set<string>();

const RETRY_BASE_MS = 1_000;
const RETRY_MAX_MS = 30_000;

// Socket.IO does not retry a refused connection (an expired token), so a new token is fetched and it is tried again, later each time.
function attachLifecycle(s: Socket): () => void {
  let attempt = 0;
  let timer: number | null = null;

  function retryLater(): void {
    if (timer !== null || s.connected || s.active || !getRefreshToken()) return;
    const delay = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** attempt);
    attempt += 1;
    timer = window.setTimeout(() => {
      timer = null;
      void reconnectNow();
    }, delay);
  }

  async function reconnectNow(): Promise<void> {
    if (s.connected || socket !== s) return;
    await refreshAccessToken();
    if (!s.connected && socket === s) s.connect();
  }

  const onConnect = () => {
    attempt = 0;
    rooms.forEach((visitId) => s.emit("visit:join", { visitId }));
  };
  const onRefused = () => retryLater();
  // A hidden tab has its timers slowed down, and a network that returns says nothing to Socket.IO.
  const onWake = () => {
    if (document.hidden || s.connected || s.active) return;
    attempt = 0;
    void reconnectNow();
  };

  s.on("connect", onConnect);
  s.on("connect_error", onRefused);
  s.on("disconnect", onRefused);
  document.addEventListener("visibilitychange", onWake);
  window.addEventListener("online", onWake);

  return () => {
    if (timer !== null) window.clearTimeout(timer);
    document.removeEventListener("visibilitychange", onWake);
    window.removeEventListener("online", onWake);
  };
}

export function getSocket(): Socket {
  if (socket) return socket;
  socket = io(socketOrigin(), {
    path: "/socket.io",
    // Read on every attempt, so a reconnect always carries the newest token.
    auth: (send) => send({ token: localStorage.getItem(TOKEN_KEY) ?? "" }),
    // Websocket first, polling as a fallback rather than not at all, a
    // corporate proxy that blocks websockets would otherwise leave the admin
    // with no realtime at all instead of a slower one.
    transports: ["websocket", "polling"],
    autoConnect: true,
    reconnectionDelayMax: 10_000,
  });
  detach = attachLifecycle(socket);
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
  detach?.();
  detach = null;
  socket?.close();
  socket = null;
}
