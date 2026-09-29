import { useEffect, useState } from "react";
import {
  useListEnquiriesQuery,
  useGetEnquiryQuery,
  useSetEnquiryReadMutation,
  useSetEnquiryResolvedMutation,
  useReplyToEnquiryMutation,
  usePreviewEnquiryReplyMutation,
  useBulkDeleteEnquiriesMutation,
  useDeleteEnquiryMutation,
} from "../store/endpoints/helpApi";
import { showSuccess, showError } from "../lib/toast";
import { errMsg } from "../lib/errMsg";
import { useDialog } from "../components/ui/DialogProvider";
import { useAuth } from "../store/useAuth";
import Loader from "../components/Loader";
import Portal from "../components/ui/Portal";
import Select from "../components/ui/Select";
import { TrashIcon, CloseIcon } from "../components/icons";
import type { ContactEnquiry } from "../types";

const PAGE_SIZE = 15;

function when(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function ResolvedBadge({ resolved }: { resolved: boolean }) {
  return resolved ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
      <span className="h-1.5 w-1.5 rounded-full bg-success" />
      Resolved
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      Open
    </span>
  );
}

function Detail({
  id,
  onClose,
  canManage,
  onDelete,
}: {
  id: string;
  onClose: () => void;
  canManage: boolean;
  onDelete: (e: ContactEnquiry) => void;
}) {
  // Fetching one is what marks it read, so the list refetches behind this.
  const { data, isLoading } = useGetEnquiryQuery(id);
  const enquiry = data?.enquiry;
  const replies = data?.replies ?? [];
  const [setRead] = useSetEnquiryReadMutation();
  const [setResolved, { isLoading: resolving }] = useSetEnquiryResolvedMutation();
  const [sendReply, { isLoading: sending }] = useReplyToEnquiryMutation();
  const [buildPreview, { isLoading: previewing }] = usePreviewEnquiryReplyMutation();

  const [composing, setComposing] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [resolveAfter, setResolveAfter] = useState(true);
  const [errors, setErrors] = useState<{ subject?: string; message?: string }>({});
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(
    null
  );

  function startReply() {
    const about = enquiry?.subject?.trim() ?? "";
    // Their own subject, prefixed once however many times this is opened.
    setSubject(
      about ? (/^re:/i.test(about) ? about : `Re: ${about}`) : "Re: your message"
    );
    setMessage("");
    setErrors({});
    setPreview(null);
    setComposing(true);
  }

  // The same limits the server keeps, so nothing is refused after it is typed.
  function validate(): boolean {
    const next: { subject?: string; message?: string } = {};
    const s = subject.trim();
    const m = message.trim();
    if (s.length < 3) next.subject = "The subject must be at least 3 characters.";
    else if (s.length > 150)
      next.subject = "The subject must be at most 150 characters.";
    if (m.length < 10) next.message = "The reply must be at least 10 characters.";
    else if (m.length > 5000)
      next.message = "The reply must be at most 5000 characters.";
    setErrors(next);
    return !next.subject && !next.message;
  }

  async function handlePreview() {
    if (!enquiry || !validate()) return;
    try {
      const built = await buildPreview({
        id: enquiry.id,
        body: { subject: subject.trim(), message: message.trim() },
      }).unwrap();
      setPreview(built);
    } catch (err) {
      showError(errMsg(err));
    }
  }

  async function handleSend() {
    if (!enquiry || !validate()) return;
    try {
      await sendReply({
        id: enquiry.id,
        body: {
          subject: subject.trim(),
          message: message.trim(),
          resolve: resolveAfter,
        },
      }).unwrap();
      showSuccess(`Reply sent to ${enquiry.email}.`);
      setComposing(false);
      setPreview(null);
      setMessage("");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  // Rendered at the end of body, so the backdrop covers the sidebar as well.
  return (
    <Portal>
      <div className="modal-overlay" onMouseDown={onClose}>
        <div
          className="modal-panel card max-h-[90vh] w-full max-w-2xl overflow-y-auto"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-gray-300 px-5 py-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-gray-900">Enquiry</h2>
              {enquiry && <ResolvedBadge resolved={enquiry.is_resolved} />}
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="grid h-8 w-8 place-items-center rounded-lg text-gray-500 hover:bg-gray-100"
            >
              <CloseIcon width={18} height={18} />
            </button>
          </div>

          {isLoading || !enquiry ? (
            <Loader message="Loading..." />
          ) : (
            <>
              <div className="space-y-4 px-5 py-5">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                    Subject
                  </p>
                  <p className="mt-1 text-base font-semibold text-gray-900">
                    {enquiry.subject ?? "No subject"}
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                      From
                    </p>
                    <p className="mt-1 text-sm text-gray-900">{enquiry.name}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                      Sent
                    </p>
                    <p className="mt-1 text-sm text-gray-900">{when(enquiry.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                      Email
                    </p>
                    <a
                      href={`mailto:${enquiry.email}`}
                      className="mt-1 block break-all text-sm text-primary hover:underline"
                    >
                      {enquiry.email}
                    </a>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                      Phone
                    </p>
                    {enquiry.phone ? (
                      <a
                        href={`tel:${enquiry.phone}`}
                        className="mt-1 block text-sm text-primary hover:underline"
                      >
                        {enquiry.phone}
                      </a>
                    ) : (
                      <p className="mt-1 text-sm text-gray-500">Not given</p>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                    What they said
                  </p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-800">
                    {enquiry.message}
                  </p>
                </div>

                {replies.length > 0 && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                      Replies sent ({replies.length})
                    </p>
                    <ul className="mt-2 space-y-3">
                      {replies.map((r) => (
                        <li
                          key={r.id}
                          className="rounded-lg border border-gray-300 bg-gray-50 p-3"
                        >
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <p className="text-sm font-semibold text-gray-900">
                              {r.subject}
                            </p>
                            <p className="text-xs text-gray-500">
                              {when(r.created_at)}
                            </p>
                          </div>
                          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-700">
                            {r.message}
                          </p>
                          <p className="mt-2 break-all text-xs text-gray-500">
                            Sent to {r.to_email}
                            {r.sent_by_name ? ` by ${r.sent_by_name}` : ""}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {composing && canManage && (
                  <div className="rounded-lg border border-gray-300 p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-900">
                        Reply by email
                      </p>
                      <p className="break-all text-xs text-gray-500">
                        To {enquiry.email}
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      The logo, the greeting and a copy of their message are added
                      by the template. Write the subject and the message only.
                    </p>

                    <div className="mt-3">
                      <label htmlFor="replySubject" className="label">
                        Subject
                      </label>
                      <input
                        id="replySubject"
                        className={`input-field ${errors.subject ? "input-error" : ""}`}
                        value={subject}
                        maxLength={150}
                        onChange={(e) => setSubject(e.target.value)}
                      />
                      {errors.subject && (
                        <p className="field-error">{errors.subject}</p>
                      )}
                    </div>

                    <div className="mt-3">
                      <label htmlFor="replyMessage" className="label">
                        Message
                      </label>
                      <textarea
                        id="replyMessage"
                        rows={6}
                        className={`input-field min-h-[120px] ${errors.message ? "input-error" : ""}`}
                        placeholder="Your account has been activated. You can sign in from the app again."
                        value={message}
                        maxLength={5000}
                        onChange={(e) => setMessage(e.target.value)}
                      />
                      {errors.message ? (
                        <p className="field-error">{errors.message}</p>
                      ) : (
                        <p className="mt-1 text-xs text-gray-500">
                          {message.trim().length} of 5000 characters.
                        </p>
                      )}
                    </div>

                    <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={resolveAfter}
                        onChange={(e) => setResolveAfter(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-primary"
                      />
                      Mark this enquiry resolved after sending
                    </label>

                    {preview && (
                      <div className="mt-4">
                        <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                          This is what they will receive
                        </p>
                        <p className="mt-1 break-words text-xs text-gray-500">
                          Subject: {preview.subject}
                        </p>
                        {/* Sandboxed: the preview is shown, never run. */}
                        <iframe
                          title="Email preview"
                          srcDoc={preview.html}
                          sandbox=""
                          className="mt-2 h-80 w-full rounded-lg border border-gray-300 bg-white"
                        />
                      </div>
                    )}
                  </div>
                )}

                {enquiry.is_resolved && enquiry.resolved_at && (
                  <p className="text-xs text-gray-500">
                    Marked resolved on {when(enquiry.resolved_at)}.
                  </p>
                )}
              </div>

              <div className="flex flex-wrap justify-end gap-2 border-t border-gray-300 px-5 py-4">
                {composing && canManage ? (
                  <>
                    <button
                      onClick={() => {
                        setComposing(false);
                        setPreview(null);
                      }}
                      disabled={sending}
                      className="btn-secondary disabled:opacity-60"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => void handlePreview()}
                      disabled={previewing || sending}
                      className="btn-secondary disabled:opacity-60"
                    >
                      {previewing ? "Building..." : "Preview"}
                    </button>
                    <button
                      onClick={() => void handleSend()}
                      disabled={sending}
                      className="btn-primary disabled:opacity-60"
                    >
                      {sending ? "Sending..." : "Send reply"}
                    </button>
                  </>
                ) : (
                  <>
                    {canManage && (
                      <>
                        <button
                          onClick={async () => {
                            try {
                              await setRead({
                                id: enquiry.id,
                                isRead: false,
                              }).unwrap();
                              showSuccess("Marked unread.");
                              onClose();
                            } catch (err) {
                              showError(errMsg(err));
                            }
                          }}
                          className="btn-secondary"
                        >
                          Mark unread
                        </button>
                        <button
                          onClick={() => onDelete(enquiry)}
                          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-danger hover:bg-danger/5"
                        >
                          Delete
                        </button>
                      </>
                    )}
                    <button
                      onClick={async () => {
                        try {
                          await setResolved({
                            id: enquiry.id,
                            isResolved: !enquiry.is_resolved,
                          }).unwrap();
                          showSuccess(
                            enquiry.is_resolved ? "Reopened." : "Marked resolved."
                          );
                        } catch (err) {
                          showError(errMsg(err));
                        }
                      }}
                      disabled={resolving}
                      className="btn-secondary disabled:opacity-60"
                    >
                      {resolving
                        ? "Saving..."
                        : enquiry.is_resolved
                          ? "Reopen"
                          : "Mark resolved"}
                    </button>
                    {/* Sending in the platform's name stays with the platform
                        team; anyone else still gets their own mail app. */}
                    {canManage ? (
                      <button onClick={startReply} className="btn-primary">
                        Reply by email
                      </button>
                    ) : (
                      <a href={`mailto:${enquiry.email}`} className="btn-primary">
                        Reply by email
                      </a>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </Portal>
  );
}

export default function ContactEnquiries() {
  const { confirm } = useDialog();
  const { user } = useAuth();
  // Deleting and the unread toggle stay with the platform team. Resolving does
  // not, because a program administrator is the one answering.
  const canManage = user?.role === "super_admin" || user?.role === "admin";

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);

  const { data, isLoading, isError } = useListEnquiriesQuery({
    page,
    limit: PAGE_SIZE,
    ...(status ? { status: status as "read" | "unread" | "resolved" | "open" } : {}),
    ...(search.trim() ? { search: search.trim() } : {}),
  });
  const [deleteEnquiry] = useDeleteEnquiryMutation();
  const [bulkDelete, { isLoading: bulkDeleting }] = useBulkDeleteEnquiriesMutation();
  const [setResolved] = useSetEnquiryResolvedMutation();

  const enquiries = data?.enquiries ?? [];
  const meta = data?.meta ?? null;
  const totalPages = meta?.totalPages ?? 1;

  // A row that has left the page must not stay ticked and get deleted later.
  useEffect(() => {
    setPicked((prev) => prev.filter((id) => enquiries.some((e) => e.id === id)));
  }, [enquiries]);

  const allPicked = enquiries.length > 0 && picked.length === enquiries.length;
  const somePicked = picked.length > 0 && !allPicked;

  function toggleAll() {
    setPicked(allPicked ? [] : enquiries.map((e) => e.id));
  }

  function togglePick(id: string) {
    setPicked((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleDelete(enquiry: ContactEnquiry) {
    const ok = await confirm({
      title: "Delete this enquiry?",
      message: `The message from ${enquiry.name} will be removed. This cannot be undone.`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await deleteEnquiry(enquiry.id).unwrap();
      showSuccess("Enquiry deleted.");
      setOpenId(null);
    } catch (err) {
      showError(errMsg(err));
    }
  }

  async function handleBulkDelete() {
    const n = picked.length;
    const ok = await confirm({
      title: `Delete ${n} ${n === 1 ? "enquiry" : "enquiries"}?`,
      message: "The selected messages will be removed. This cannot be undone.",
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    try {
      const { removed } = await bulkDelete(picked).unwrap();
      showSuccess(`${removed} ${removed === 1 ? "enquiry" : "enquiries"} deleted.`);
      setPicked([]);
    } catch (err) {
      showError(errMsg(err));
    }
  }

  async function handleResolve(enquiry: ContactEnquiry) {
    try {
      await setResolved({
        id: enquiry.id,
        isResolved: !enquiry.is_resolved,
      }).unwrap();
      showSuccess(enquiry.is_resolved ? "Reopened." : "Marked resolved.");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contact enquiries</h1>
          <p className="mt-1 text-sm text-gray-500">
            Messages sent from the Contact Us form in the app. Someone whose account is
            switched off can still write in, so this is where they land.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {data && data.unread > 0 && (
            <span className="rounded-full bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">
              {data.unread} unread
            </span>
          )}
          {data && data.open > 0 && (
            <span className="rounded-full bg-amber-100 px-3 py-1.5 text-sm font-semibold text-amber-700">
              {data.open} open
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search name, email, subject or message..."
          maxLength={200}
          className="input-field text-sm sm:max-w-sm"
        />
        <Select
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          options={[
            { value: "", label: "All" },
            { value: "open", label: "Open" },
            { value: "resolved", label: "Resolved" },
            { value: "unread", label: "Unread" },
            { value: "read", label: "Read" },
          ]}
          className="w-40"
        />
      </div>

      {/* Sits above the table so the count and the action are next to each other. */}
      {canManage && picked.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
          <p className="text-sm font-medium text-gray-800">
            {picked.length} selected
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPicked([])} className="btn-secondary py-1.5 text-sm">
              Clear
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="flex items-center gap-2 rounded-lg bg-danger px-3.5 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              <TrashIcon width={15} height={15} />
              {bulkDeleting ? "Deleting..." : "Delete selected"}
            </button>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        {isLoading ? (
          <Loader message="Loading enquiries..." />
        ) : isError ? (
          <div className="px-5 py-16 text-center text-sm text-gray-500">
            Couldn't load the enquiries.
          </div>
        ) : enquiries.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-gray-500">
            {search || status ? "Nothing matches that." : "No enquiries yet."}
          </div>
        ) : (
          <>
            <div>
              {/* Fixed layout so a long message cuts off instead of pushing the
                  buttons off the right edge. The whole message is in the panel
                  that opens on click. */}
              <table className="w-full table-fixed text-left text-sm">
                <thead className="border-b border-gray-300 bg-gray-50">
                  <tr>
                    {canManage && (
                      <th className="w-10 px-3 py-3">
                        <input
                          type="checkbox"
                          aria-label="Select all on this page"
                          checked={allPicked}
                          ref={(el) => {
                            if (el) el.indeterminate = somePicked;
                          }}
                          onChange={toggleAll}
                          className="h-4 w-4 rounded border-gray-300 text-primary"
                        />
                      </th>
                    )}
                    <th className="w-48 px-4 py-3 font-semibold text-gray-600">From</th>
                    <th className="px-4 py-3 font-semibold text-gray-600">Subject</th>
                    <th className="hidden w-28 px-4 py-3 font-semibold text-gray-600 lg:table-cell">
                      Status
                    </th>
                    <th className="hidden w-40 px-4 py-3 font-semibold text-gray-600 xl:table-cell">
                      Sent
                    </th>
                    <th className="w-48 px-4 py-3 text-right font-semibold text-gray-600">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {enquiries.map((e) => (
                    <tr
                      key={e.id}
                      className={`cursor-pointer hover:bg-gray-50 ${e.is_read ? "" : "bg-primary/5"}`}
                      onClick={() => setOpenId(e.id)}
                    >
                      {canManage && (
                        <td className="px-3 py-3" onClick={(ev) => ev.stopPropagation()}>
                          <input
                            type="checkbox"
                            aria-label={`Select the message from ${e.name}`}
                            checked={picked.includes(e.id)}
                            onChange={() => togglePick(e.id)}
                            className="h-4 w-4 rounded border-gray-300 text-primary"
                          />
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {!e.is_read && (
                            <span
                              className="h-2 w-2 shrink-0 rounded-full bg-primary"
                              aria-label="Unread"
                            />
                          )}
                          <div className="min-w-0">
                            <p
                              className={`truncate text-sm ${e.is_read ? "text-gray-900" : "font-semibold text-gray-900"}`}
                            >
                              {e.name}
                            </p>
                            <p className="truncate text-xs text-gray-500">{e.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="truncate text-sm text-gray-900">
                          {e.subject ?? "No subject"}
                        </p>
                        <p className="truncate text-xs text-gray-500">{e.message}</p>
                      </td>
                      <td className="hidden px-4 py-3 lg:table-cell">
                        <ResolvedBadge resolved={e.is_resolved} />
                      </td>
                      <td className="hidden truncate px-4 py-3 text-sm text-gray-600 xl:table-cell">
                        {when(e.created_at)}
                      </td>
                      <td className="px-4 py-3" onClick={(ev) => ev.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => void handleResolve(e)}
                            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          >
                            {e.is_resolved ? "Reopen" : "Resolve"}
                          </button>
                          <button
                            onClick={() => setOpenId(e.id)}
                            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          >
                            Open
                          </button>
                          {canManage && (
                            <button
                              onClick={() => void handleDelete(e)}
                              aria-label="Delete"
                              className="grid h-8 w-8 place-items-center rounded-lg border border-gray-300 text-danger hover:bg-danger/5"
                            >
                              <TrashIcon width={15} height={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col items-center justify-between gap-3 border-t border-gray-300 px-5 py-3 sm:flex-row">
              <p className="text-sm text-gray-500">
                Page {meta?.page ?? page} of {totalPages}
                {meta ? ` (${meta.total.toLocaleString()} total)` : ""}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="btn-secondary py-1.5 text-sm disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= totalPages}
                  className="btn-secondary py-1.5 text-sm disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {openId && (
        <Detail
          id={openId}
          onClose={() => setOpenId(null)}
          canManage={canManage}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
