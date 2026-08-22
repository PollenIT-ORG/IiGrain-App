import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useListNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  useDeleteNotificationMutation,
  useDeleteNotificationsMutation,
  useDeleteAllNotificationsMutation,
  type AppNotification,
} from "../store/endpoints/notificationsApi";
import Loader from "../components/Loader";
import { useDialog } from "../components/ui/DialogProvider";
import { showSuccess, showError } from "../lib/toast";
import { TrashIcon } from "../components/icons";

const PAGE_SIZE = 20;

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

export default function Notifications() {
  const navigate = useNavigate();
  const { confirm } = useDialog();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data, isLoading, isFetching, isError, refetch } =
    useListNotificationsQuery({ page, limit: PAGE_SIZE });
  const [markRead] = useMarkNotificationReadMutation();
  const [markAllRead, { isLoading: markingAll }] =
    useMarkAllNotificationsReadMutation();
  const [deleteOne] = useDeleteNotificationMutation();
  const [deleteMany, { isLoading: deletingMany }] =
    useDeleteNotificationsMutation();
  const [deleteAll, { isLoading: deletingAll }] =
    useDeleteAllNotificationsMutation();

  const notifications = data?.notifications ?? [];
  const unread = data?.unreadCount ?? 0;
  const meta = data?.meta ?? null;
  const totalPages = meta?.totalPages ?? 1;
  const total = meta?.total ?? notifications.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allOnPageSelected =
    notifications.length > 0 && notifications.every((n) => selected.has(n.id));

  function toggleAllOnPage() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        notifications.forEach((n) => next.delete(n.id));
      } else {
        notifications.forEach((n) => next.add(n.id));
      }
      return next;
    });
  }

  function handleOpen(n: AppNotification) {
    if (!n.read) markRead(n.id);
    const route = adminRouteFor(n);
    if (route) navigate(route);
  }

  async function handleDeleteOne(n: AppNotification) {
    const ok = await confirm({
      title: "Delete notification?",
      message: `"${n.title}" will be removed.`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await deleteOne(n.id).unwrap();
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(n.id);
        return next;
      });
      showSuccess("Notification deleted.");
    } catch {
      showError("Could not delete the notification.");
    }
  }

  async function handleDeleteSelected() {
    const ids = [...selected];
    if (ids.length === 0) return;
    const ok = await confirm({
      title: "Delete selected?",
      message: `${ids.length} notification(s) will be deleted.`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await deleteMany(ids).unwrap();
      setSelected(new Set());
      showSuccess("Notifications deleted.");
    } catch {
      showError("Could not delete the notifications.");
    }
  }

  async function handleDeleteAll() {
    const ok = await confirm({
      title: "Delete all notifications?",
      message: "Every notification will be removed. This cannot be undone.",
      confirmLabel: "Delete all",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await deleteAll().unwrap();
      setSelected(new Set());
      showSuccess("All notifications deleted.");
    } catch {
      showError("Could not delete notifications.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="mt-1 text-sm text-gray-500">
            {total} total{unread > 0 ? ` - ${unread} unread` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selected.size > 0 && (
            <button
              onClick={handleDeleteSelected}
              disabled={deletingMany}
              className="btn-secondary text-danger hover:bg-danger/5"
            >
              <TrashIcon width={16} height={16} />
              Delete selected ({selected.size})
            </button>
          )}
          {unread > 0 && (
            <button
              onClick={() => markAllRead()}
              disabled={markingAll}
              className="btn-secondary"
            >
              Mark all read
            </button>
          )}
          {total > 0 && (
            <button
              onClick={handleDeleteAll}
              disabled={deletingAll}
              className="btn-secondary text-danger hover:bg-danger/5"
            >
              Delete all
            </button>
          )}
        </div>
      </div>

      <div className="card overflow-hidden">
        {isLoading || isFetching ? (
          <Loader message="Loading notifications..." />
        ) : isError ? (
          <div className="px-5 py-16 text-center">
            <p className="text-sm text-gray-500">
              Could not load notifications.
            </p>
            <button onClick={() => refetch()} className="btn-secondary mt-4">
              Retry
            </button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-gray-500">
            No notifications yet.
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 border-b border-gray-300 bg-gray-50 px-5 py-2.5">
              <input
                type="checkbox"
                checked={allOnPageSelected}
                onChange={toggleAllOnPage}
                className="h-4 w-4 cursor-pointer rounded border-gray-300 accent-primary"
                aria-label="Select all on this page"
              />
              <span className="text-xs font-medium text-gray-500">
                {selected.size > 0
                  ? `${selected.size} selected`
                  : "Select all on this page"}
              </span>
            </div>
            <ul>
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className={`flex items-start gap-3 border-b border-gray-200 px-5 py-4 last:border-0 ${
                    n.read ? "" : "bg-primary/5"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(n.id)}
                    onChange={() => toggle(n.id)}
                    className="mt-1 h-4 w-4 cursor-pointer rounded border-gray-300 accent-primary"
                    aria-label="Select notification"
                  />
                  <button
                    onClick={() => handleOpen(n)}
                    className="flex-1 text-left"
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">
                        {n.title}
                      </span>
                      {!n.read && (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                      )}
                    </span>
                    {n.body && (
                      <span className="mt-0.5 block text-sm text-gray-600">
                        {n.body}
                      </span>
                    )}
                    <span className="mt-0.5 block text-xs text-gray-400">
                      {timeAgo(n.created_at)}
                    </span>
                  </button>
                  <button
                    onClick={() => handleDeleteOne(n)}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-gray-400 hover:bg-danger/5 hover:text-danger"
                    aria-label="Delete notification"
                  >
                    <TrashIcon width={15} height={15} />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-300 px-5 py-3 text-sm">
            <span className="text-gray-500">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
