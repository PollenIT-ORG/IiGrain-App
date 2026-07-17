import type { Server as SocketServer, Socket } from "socket.io";
import {
  getUnreadCount,
  readOne,
  readAll,
} from "../services/notification.service.js";

type Ack = (res: { ok: boolean; count?: number; error?: string }) => void;

export function registerNotificationHandlers(
  _io: SocketServer,
  socket: Socket
): void {
  const user = socket.data.user;

  socket.on("notification:unread_count", async (_p: unknown, ack?: Ack) => {
    try {
      const count = await getUnreadCount(user.id);
      ack?.({ ok: true, count });
    } catch {
      ack?.({ ok: false, error: "Could not fetch unread count." });
    }
  });

  socket.on(
    "notification:read",
    async (payload: { notificationId?: string }, ack?: Ack) => {
      try {
        if (!payload?.notificationId) throw new Error("notificationId required.");
        await readOne(payload.notificationId, user.id);
        const count = await getUnreadCount(user.id);
        ack?.({ ok: true, count });
      } catch (err) {
        ack?.({
          ok: false,
          error: err instanceof Error ? err.message : "Could not mark read.",
        });
      }
    }
  );

  socket.on("notification:read_all", async (_p: unknown, ack?: Ack) => {
    try {
      await readAll(user.id);
      ack?.({ ok: true, count: 0 });
    } catch {
      ack?.({ ok: false, error: "Could not mark all read." });
    }
  });
}
