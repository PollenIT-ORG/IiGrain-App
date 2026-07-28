import { io, type Socket } from "socket.io-client";
import { API_BASE_URL } from "../config/apiConfig";

function socketOrigin(): string {
  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    return API_BASE_URL.replace(/\/api\/v\d+\/?$/, "");
  }
}

// The public survey has no login. It authenticates the socket with the
// magic-link status token; the server resolves that to the submission and
// joins the "submission:<id>" room, so the status page updates live as the
// application moves (contract sent, signed, enrolled) without a refresh.
export function connectSurveySocket(statusToken: string): Socket {
  return io(socketOrigin(), {
    path: "/socket.io",
    auth: { statusToken },
    transports: ["websocket"],
    autoConnect: true,
  });
}
