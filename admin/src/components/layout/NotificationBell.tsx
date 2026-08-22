import { useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { BellIcon } from "../icons";
import { getSocket } from "../../lib/socket";
import {
  useListNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  notificationsApi,
  type AppNotification,
} from "../../store/endpoints/notificationsApi";

// Turns a notification's redirect target into an admin route, or null if there
// is no meaningful destination in this panel.
function adminRouteFor(n: AppNotification): string | null {
  const r = n.redirect;
  if (!r) return null;
  if (r.submissionId) return `/survey-submissions/${r.submissionId}`;
  if (r.screen === "eligibility") return "/survey-submissions";
  if (r.visitId) return "/live-visits";
  if (r.fieldId) return `/fields/${r.fieldId}`;
  if (r.programId) return `/programs/${r.programId}`;
  return null;
}

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
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  function handleClick(n: AppNotification) {
    if (!n.read) markRead(n.id);
    const route = adminRouteFor(n);
    if (route) {
      setOpen(false);
      navigate(route);
    }
  }

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
        // On a phone the bell is not at the edge of the screen, so a panel
        // hung off it runs past the left edge: there it sits under the header
        // across the screen instead, and only hangs off the bell from sm up.
        <div className="fixed inset-x-3 top-[4.25rem] z-30 overflow-hidden rounded-xl border border-gray-300 bg-white shadow-card-hover sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-80">
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

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-gray-500">
                No notifications yet.
              </p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
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

          <button
            onClick={() => {
              setOpen(false);
              navigate("/notifications");
            }}
            className="block w-full border-t border-gray-300 px-4 py-2.5 text-center text-sm font-semibold text-primary hover:bg-gray-50"
          >
            View all notifications
          </button>
        </div>
      )}
    </div>
  );
}
