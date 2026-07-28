import { useEffect, useState } from "react";
import {
  useListEnquiriesQuery,
  useSetEnquiryReadMutation,
  useDeleteEnquiryMutation,
  type Enquiry,
} from "../store/endpoints/eligibilityApi";
import { errMsg } from "../lib/errMsg";
import { useLiveData } from "../lib/useLiveData";
import { showSuccess, showError } from "../lib/toast";
import { useDialog } from "../components/ui/DialogProvider";
import Loader from "../components/Loader";
import { ChevronLeftIcon, ChevronRightIcon, TrashIcon } from "../components/icons";

const PAGE_SIZE = 10;

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString();
}

export default function ContactEnquiries() {
  const { confirm } = useDialog();

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [open, setOpen] = useState<Enquiry | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => setPage(1), [search, unreadOnly]);

  const { data, isLoading, isFetching, isError, error, refetch } =
    useListEnquiriesQuery({
      page,
      limit: PAGE_SIZE,
      unreadOnly: unreadOnly || undefined,
      search: search || undefined,
    });
  useLiveData(["contact_enquiries"], refetch);

  const [setRead] = useSetEnquiryReadMutation();
  const [deleteEnquiry] = useDeleteEnquiryMutation();

  const enquiries = data?.enquiries ?? [];
  const meta = data?.meta ?? null;
  const totalPages = meta?.totalPages ?? 1;
  const loading = isLoading || isFetching;

  async function openEnquiry(e: Enquiry) {
    setOpen(e);
    if (!e.is_read) {
      try {
        await setRead({ id: e.id, isRead: true }).unwrap();
      } catch {
        // A failed read-marker should not block reading the message.
      }
    }
  }

  async function toggleRead(e: Enquiry) {
    try {
      await setRead({ id: e.id, isRead: !e.is_read }).unwrap();
    } catch (err) {
      showError(errMsg(err));
    }
  }

  async function handleDelete(e: Enquiry) {
    const ok = await confirm({
      title: "Delete this enquiry?",
      message: `The message from "${e.name}" will be removed.`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await deleteEnquiry(e.id).unwrap();
      if (open?.id === e.id) setOpen(null);
      showSuccess("Enquiry deleted.");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Contact Enquiries</h1>
        <p className="mt-1 text-sm text-gray-500">
          Messages sent through the website contact form.
          {data?.unreadCount ? (
            <span className="ml-1 font-semibold text-primary">
              {data.unreadCount} unread
            </span>
          ) : null}
        </p>
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-gray-300 p-5 sm:flex-row sm:items-center sm:justify-between">
          <input
            className="input-field sm:max-w-xs"
            placeholder="Search by name, email or subject"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <label className="flex items-center gap-2.5 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => setUnreadOnly(e.target.checked)}
              className="h-4 w-4 cursor-pointer rounded border-gray-300 accent-primary"
            />
            Unread only
          </label>
        </div>

        {loading ? (
          <Loader message="Loading enquiries..." />
        ) : isError ? (
          <div className="px-5 py-16 text-center text-sm text-gray-500">
            {errMsg(error)}
          </div>
        ) : enquiries.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-gray-500">
            No enquiries found.
          </div>
        ) : (
          <>
            <ul className="divide-y divide-gray-300/70">
              {enquiries.map((e) => (
                <li
                  key={e.id}
                  className={`flex items-start gap-4 px-5 py-4 ${e.is_read ? "" : "bg-primary/5"}`}
                >
                  <button
                    onClick={() => openEnquiry(e)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-gray-900">{e.name}</span>
                      {!e.is_read && (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                      )}
                      {e.subject && (
                        <span className="rounded-full bg-gray-300/60 px-2 py-0.5 text-xs font-medium text-gray-700">
                          {e.subject}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-xs text-gray-500">
                      {e.email}
                      {e.phone ? ` · ${e.phone}` : ""}
                    </span>
                    <span className="mt-1 block truncate text-sm text-gray-700">
                      {e.message}
                    </span>
                    <span className="mt-1 block text-xs text-gray-400">
                      {formatDateTime(e.created_at)}
                    </span>
                  </button>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => toggleRead(e)}
                      className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                    >
                      {e.is_read ? "Mark unread" : "Mark read"}
                    </button>
                    <button
                      onClick={() => handleDelete(e)}
                      className="grid h-8 w-8 place-items-center rounded-lg text-gray-400 hover:bg-danger/5 hover:text-danger"
                      aria-label="Delete enquiry"
                    >
                      <TrashIcon width={15} height={15} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <div className="flex flex-col items-center justify-between gap-3 border-t border-gray-300 px-5 py-3 sm:flex-row">
              <p className="text-sm text-gray-500">
                Page <span className="font-semibold text-gray-700">{page}</span>{" "}
                of{" "}
                <span className="font-semibold text-gray-700">{totalPages}</span>
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronLeftIcon width={16} height={16} />
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                  <ChevronRightIcon width={16} height={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {open && (
        <div className="modal-overlay" onClick={() => setOpen(null)}>
          <div
            className="modal-panel card w-full max-w-lg p-6 sm:p-7"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{open.name}</h2>
                <p className="mt-0.5 text-sm text-gray-500">{open.email}</p>
                {open.phone && (
                  <p className="text-sm text-gray-500">{open.phone}</p>
                )}
              </div>
              <button
                onClick={() => setOpen(null)}
                className="grid h-8 w-8 place-items-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                aria-label="Close"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {open.subject && (
              <p className="mt-4 text-sm font-semibold text-gray-900">
                {open.subject}
              </p>
            )}
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
              {open.message}
            </p>
            <p className="mt-4 text-xs text-gray-400">
              Received {formatDateTime(open.created_at)}
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <a href={`mailto:${open.email}`} className="btn-secondary py-2.5">
                Reply by email
              </a>
              <button onClick={() => setOpen(null)} className="btn-primary py-2.5">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
