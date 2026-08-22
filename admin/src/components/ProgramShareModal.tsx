import { useMemo, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { useSharePasProgramMutation } from "../store/endpoints/programAdminSurveyApi";
import { useListUsersQuery } from "../store/endpoints/usersApi";
import { errMsg } from "../lib/errMsg";
import { showSuccess, showError } from "../lib/toast";
import Portal from "./ui/Portal";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// The server accepts 50 addresses in one send, so the form stops there too.
const MAX_RECIPIENTS = 50;

// Share one program's survey link: a copyable link, a downloadable QR, an
// email invite typed by hand, or a pick from the farmers already on the
// platform so nobody has to look their address up.
export default function ProgramShareModal({
  id,
  name,
  link,
  onClose,
}: {
  id: string;
  name: string;
  link: string;
  onClose: () => void;
}) {
  const qrRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [share, { isLoading }] = useSharePasProgramMutation();
  const [emails, setEmails] = useState<string[]>([]);
  const [entry, setEntry] = useState("");
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Only loaded once the list is opened - most shares are a copied link.
  const { data, isFetching } = useListUsersQuery(
    { role: "farmer", status: "active", limit: 50, search: search.trim() || undefined },
    { skip: !pickerOpen }
  );

  const farmers = useMemo(
    () => (data?.users ?? []).filter((u) => EMAIL_RE.test(u.email)),
    [data]
  );

  function add(email: string, label?: string) {
    const value = email.trim().toLowerCase();
    if (!value) return;
    if (!EMAIL_RE.test(value)) return showError("Enter a valid email address.");
    if (emails.includes(value)) return;
    if (emails.length >= MAX_RECIPIENTS)
      return showError(`You can send to ${MAX_RECIPIENTS} people at a time.`);
    setEmails((list) => [...list, value]);
    if (label) setLabels((m) => ({ ...m, [value]: label }));
  }

  function remove(email: string) {
    setEmails((list) => list.filter((x) => x !== email));
  }

  function toggleFarmer(email: string, label: string) {
    const value = email.trim().toLowerCase();
    if (emails.includes(value)) remove(value);
    else add(value, label);
  }

  // Whether every farmer currently listed is already picked - the search box
  // narrows the list, so this follows what is on screen.
  const allShownPicked =
    farmers.length > 0 &&
    farmers.every((u) => emails.includes(u.email.toLowerCase()));

  function toggleAllShown() {
    const shown = farmers.map((u) => ({
      email: u.email.toLowerCase(),
      label: u.full_name || u.email,
    }));
    if (allShownPicked) {
      const drop = new Set(shown.map((s) => s.email));
      setEmails((list) => list.filter((e) => !drop.has(e)));
      return;
    }
    const merged = [...emails];
    const names: Record<string, string> = {};
    let leftOut = 0;
    for (const s of shown) {
      if (merged.includes(s.email)) continue;
      if (merged.length >= MAX_RECIPIENTS) {
        leftOut += 1;
        continue;
      }
      merged.push(s.email);
      names[s.email] = s.label;
    }
    setEmails(merged);
    setLabels((m) => ({ ...m, ...names }));
    if (leftOut > 0) {
      showError(
        `${MAX_RECIPIENTS} people can be sent to at a time, so ${leftOut} were left out.`
      );
    }
  }

  function addEntry() {
    add(entry);
    setEntry("");
  }

  async function sendEmails() {
    const list = [...emails];
    const pending = entry.trim().toLowerCase();
    if (pending && EMAIL_RE.test(pending) && !list.includes(pending))
      list.push(pending);
    if (list.length === 0) return showError("Add at least one email address.");
    if (list.length > MAX_RECIPIENTS)
      return showError(`You can send to ${MAX_RECIPIENTS} people at a time.`);
    try {
      const res = await share({ id, emails: list }).unwrap();
      showSuccess(
        `Survey link sent to ${res.sent} ${res.sent === 1 ? "person" : "people"}.`
      );
      setEmails([]);
      setLabels({});
      setEntry("");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  function copyLink() {
    void navigator.clipboard
      .writeText(link)
      .then(() => {
        setCopied(true);
        showSuccess("Survey link copied.");
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => showError("Could not copy. Copy it manually."));
  }

  function downloadQr() {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = "program-survey-qr.png";
    a.click();
  }

  return (
    <Portal>
      <div className="modal-overlay" onMouseDown={onClose}>
        <div
          className="modal-panel card max-h-[90vh] w-full max-w-lg overflow-y-auto p-6 sm:p-7"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-gray-900">Share the survey</h2>
              <p className="mt-0.5 truncate text-sm text-gray-500">
                {name}
              </p>
            </div>
            <button
              onClick={onClose}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Close"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mt-5">
            <label className="label">Survey link</label>
            <div className="flex gap-2">
              <input readOnly value={link} className="input-field flex-1 text-gray-600" />
              <button onClick={copyLink} className="btn-secondary shrink-0">
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-5 rounded-lg border border-gray-300 p-4">
            <div ref={qrRef} className="rounded-lg bg-white p-2">
              <QRCodeCanvas value={link} size={104} level="M" marginSize={0} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900">QR code</p>
              <p className="mt-0.5 text-xs text-gray-500">
                Print it or add it to a flyer. Scanning opens this program's
                survey.
              </p>
              <button onClick={downloadQr} className="btn-secondary mt-3 py-2 text-sm">
                Download QR
              </button>
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-end justify-between gap-3">
              <label className="label mb-0">Invite by email</label>
              <button
                type="button"
                onClick={() => setPickerOpen((v) => !v)}
                className="text-xs font-semibold text-primary hover:underline"
              >
                {pickerOpen ? "Hide farmers" : "Pick existing farmers"}
              </button>
            </div>
            <div className="mt-1.5 flex gap-2">
              <input
                value={entry}
                onChange={(e) => setEntry(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addEntry();
                  }
                }}
                className="input-field flex-1"
                placeholder="producer@example.com"
                type="email"
                maxLength={255}
              />
              <button onClick={addEntry} type="button" className="btn-secondary shrink-0">
                Add
              </button>
            </div>

            {pickerOpen && (
              <div className="mt-3 rounded-lg border border-gray-300">
                <div className="border-b border-gray-200 p-2">
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="input-field py-2 text-sm"
                    placeholder="Search farmers by name or email"
                    aria-label="Search farmers"
                    maxLength={100}
                  />
                  {farmers.length > 0 && (
                    <div className="mt-2 flex items-center justify-between px-1">
                      <button
                        type="button"
                        onClick={toggleAllShown}
                        className="text-xs font-semibold text-primary hover:underline"
                      >
                        {allShownPicked
                          ? "Clear all"
                          : `Select all ${farmers.length}`}
                      </button>
                      <span className="text-xs text-gray-500">
                        {emails.length} selected
                      </span>
                    </div>
                  )}
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {isFetching && (
                    <p className="p-3 text-sm text-gray-500">Loading farmers...</p>
                  )}
                  {!isFetching && farmers.length === 0 && (
                    <p className="p-3 text-sm text-gray-500">
                      No farmers found.
                    </p>
                  )}
                  {!isFetching &&
                    farmers.map((u) => {
                      const email = u.email.toLowerCase();
                      const picked = emails.includes(email);
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() =>
                            toggleFarmer(email, u.full_name || u.email)
                          }
                          className={`flex w-full items-center gap-3 border-b border-gray-100 p-2.5 text-left last:border-b-0 hover:bg-gray-50 ${
                            picked ? "bg-primary/5" : ""
                          }`}
                        >
                          <span
                            className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${
                              picked
                                ? "border-primary bg-primary text-white"
                                : "border-gray-300"
                            }`}
                            aria-hidden="true"
                          >
                            {picked && (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m5 13 4 4L19 7" />
                              </svg>
                            )}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-gray-900">
                              {u.full_name || "Unnamed farmer"}
                            </span>
                            <span className="block truncate text-xs text-gray-500">
                              {u.email}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                </div>
              </div>
            )}

            {emails.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {emails.map((em) => (
                  <span
                    key={em}
                    className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700"
                    title={em}
                  >
                    {labels[em] ?? em}
                    <button
                      onClick={() => remove(em)}
                      className="text-gray-400 hover:text-danger"
                      aria-label={`Remove ${em}`}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            )}
            <p className="mt-2 text-xs text-gray-500">
              The invite email carries this program's survey link and our logo.
              It sends in the background.
            </p>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button onClick={onClose} className="btn-secondary py-2.5">
              Close
            </button>
            <button
              onClick={sendEmails}
              disabled={isLoading}
              className="btn-primary py-2.5"
            >
              {isLoading
                ? "Sending..."
                : emails.length > 0
                  ? `Send to ${emails.length}`
                  : "Send invites"}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
