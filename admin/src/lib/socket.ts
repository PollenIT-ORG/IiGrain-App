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

export function getSocket(): Socket {
  if (socket) return socket;
  socket = io(socketOrigin(), {
    path: "/socket.io",
    auth: { token: localStorage.getItem(TOKEN_KEY) ?? "" },
    transports: ["websocket"],
    autoConnect: true,
  });
  return socket;
}

export function closeSocket(): void {
  socket?.close();
  socket = null;
}
