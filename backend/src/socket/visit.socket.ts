import type { Server as SocketServer, Socket } from "socket.io";
import logger from "../utils/logger.js";
import {
  pushLocation,
  arriveVisit,
  finishVisit,
  getVisitForViewer,
} from "../services/visit.service.js";
import type { PublicVisit } from "../models/visit.model.js";

const room = (visitId: string) => `visit:${visitId}`;

function isAdmin(role: string): boolean {
  return role === "super_admin" || role === "admin";
}

type Ack = (res: { ok: boolean; visit?: PublicVisit; error?: string }) => void;

export function registerVisitHandlers(io: SocketServer, socket: Socket): void {
  const user = socket.data.user;

  socket.on("visit:join", async (payload: { visitId?: string }, ack?: Ack) => {
    try {
      const visitId = payload?.visitId;
      if (!visitId) throw new Error("visitId is required.");
      const visit = await getVisitForViewer(visitId, {
        id: user.id,
        role: user.role,
      });
      await socket.join(room(visitId));
      ack?.({ ok: true, visit });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not join visit.";
      ack?.({ ok: false, error: message });
      socket.emit("visit:error", { message });
    }
  });

  socket.on(
    "visit:location",
    async (
      payload: {
        visitId?: string;
        lat?: number;
        lng?: number;
        accuracy_m?: number;
        is_mock?: boolean;
      },
      ack?: Ack
    ) => {
      try {
        const { visitId, lat, lng, accuracy_m, is_mock } = payload ?? {};
        if (!visitId || typeof lat !== "number" || typeof lng !== "number") {
          throw new Error("visitId, lat and lng are required.");
        }
        const visit = await pushLocation(visitId, user.id, {
          lat,
          lng,
          accuracyM: typeof accuracy_m === "number" ? accuracy_m : null,
          isMock: is_mock === true,
        });
        io.to(room(visitId)).emit("visit:location", visit);
        ack?.({ ok: true, visit });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not update location.";
        ack?.({ ok: false, error: message });
        socket.emit("visit:error", { message });
      }
    }
  );

  socket.on(
    "visit:arrived",
    async (
      payload: {
        visitId?: string;
        lat?: number;
        lng?: number;
        accuracy_m?: number;
        is_mock?: boolean;
      },
      ack?: Ack
    ) => {
      try {
        const { visitId, lat, lng, accuracy_m, is_mock } = payload ?? {};
        if (!visitId) throw new Error("visitId is required.");
        const position =
          typeof lat === "number" && typeof lng === "number"
            ? {
                latitude: lat,
                longitude: lng,
                accuracyM: typeof accuracy_m === "number" ? accuracy_m : null,
                isMock: is_mock === true,
              }
            : null;
        const visit = await arriveVisit(visitId, user.id, position);
        io.to(room(visitId)).emit("visit:status", visit);
        ack?.({ ok: true, visit });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not mark arrived.";
        ack?.({ ok: false, error: message });
        socket.emit("visit:error", { message });
      }
    }
  );

  socket.on(
    "visit:end",
    async (
      payload: { visitId?: string; outcome?: "completed" | "cancelled" },
      ack?: Ack
    ) => {
      try {
        const visitId = payload?.visitId;
        const outcome = payload?.outcome ?? "completed";
        if (!visitId) throw new Error("visitId is required.");
        if (outcome !== "completed" && outcome !== "cancelled") {
          throw new Error("outcome must be 'completed' or 'cancelled'.");
        }
        const visit = await finishVisit(visitId, user.id, outcome);
        io.to(room(visitId)).emit("visit:status", visit);
        ack?.({ ok: true, visit });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not end visit.";
        ack?.({ ok: false, error: message });
        socket.emit("visit:error", { message });
      }
    }
  );

  if (isAdmin(user.role)) {
    void socket.join("admins");
  }

  logger.debug?.(`visit handlers registered for ${user.email}`);
}
