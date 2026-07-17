import { useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { BellIcon } from "../icons";
import { getSocket } from "../../lib/socket";
import {
  useListNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  notificationsApi,
} from "../../store/endpoints/notificationsApi";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function NotificationBell() {
  const dispatch = useDispatch();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const { data } = useListNotificationsQuery({ page: 1, limit: 15 });
  const [markRead] = useMarkNotificationReadMutation();
  const [markAllRead] = useMarkAllNotificationsReadMutation();

  const notifications = data?.notifications ?? [];
  const unread = data?.unreadCount ?? 0;

  useEffect(() => {
    const socket = getSocket();
    const refresh = () => {
      dispatch(
        notificationsApi.util.invalidateTags(["Notifications"])
      );
    };
    socket.on("notification:new", refresh);
    socket.on("notification:unread_count", refresh);
    return () => {
      socket.off("notification:new", refresh);
      socket.off("notification:unread_count", refresh);
    };
  }, [dispatch]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative grid h-10 w-10 place-items-center rounded-lg text-gray-700 hover:bg-gray-100"
        aria-label="Notifications"
      >
        <BellIcon width={20} height={20} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white ring-2 ring-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-xl border border-gray-300 bg-white shadow-card-hover">
          <div className="flex items-center justify-between border-b border-gray-300 px-4 py-3">
            <span className="text-sm font-semibold text-gray-900">
              Notifications
            </span>
            {unread > 0 && (
              <button
                onClick={() => markAllRead()}
                className="text-xs font-semibold text-primary hover:text-primary-dark"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-gray-500">
                No notifications yet.
              </p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => !n.read && markRead(n.id)}
                  className={`flex w-full flex-col items-start gap-0.5 border-b border-gray-200 px-4 py-3 text-left last:border-0 hover:bg-gray-50 ${
                    n.read ? "" : "bg-primary/5"
                  }`}
                >
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-gray-900">
                      {n.title}
                    </span>
                    {!n.read && (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                    )}
                  </span>
                  {n.body && (
                    <span className="text-xs text-gray-600">{n.body}</span>
                  )}
                  <span className="text-[11px] text-gray-400">
                    {timeAgo(n.created_at)}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
