import { useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { useShareSurveyMutation } from "../store/endpoints/eligibilityApi";
import { errMsg } from "../lib/errMsg";
import { showSuccess, showError } from "./../lib/toast";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// The public survey is served by this same admin app at /survey.
function surveyLink(): string {
  return `${window.location.origin}/survey`;
}

export default function ShareSurveyModal({ onClose }: { onClose: () => void }) {
  const link = surveyLink();
  const qrRef = useRef<HTMLDivElement>(null);
  const [share, { isLoading }] = useShareSurveyMutation();

  const [emails, setEmails] = useState<string[]>([]);
  const [entry, setEntry] = useState("");
  const [copied, setCopied] = useState(false);

  function copyLink() {
    void navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function downloadQr() {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = "survey-qr.png";
    a.click();
  }

  function addEntry() {
    const value = entry.trim().toLowerCase();
    if (!value) return;
    if (!EMAIL_RE.test(value)) {
      showError("Enter a valid email address.");
      return;
    }
    if (!emails.includes(value)) setEmails((e) => [...e, value]);
    setEntry("");
  }

  async function sendEmails() {
    const list = [...emails];
    const pending = entry.trim().toLowerCase();
    if (pending && EMAIL_RE.test(pending) && !list.includes(pending)) {
      list.push(pending);
    }
    if (list.length === 0) {
      showError("Add at least one email address.");
      return;
    }
    try {
      const res = await share(list).unwrap();
      showSuccess(`Survey link sent to ${res.sent} ${res.sent === 1 ? "address" : "addresses"}.`);
      setEmails([]);
      setEntry("");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div
        className="modal-panel card w-full max-w-lg p-6 sm:p-7"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Share the survey</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              Send producers the link, a QR code, or invite them by email.
            </p>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Link */}
        <div className="mt-5">
          <label className="label">Survey link</label>
          <div className="flex gap-2">
            <input readOnly value={link} className="input-field flex-1 text-gray-600" />
            <button onClick={copyLink} className="btn-secondary shrink-0">
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        {/* QR */}
        <div className="mt-5 flex items-center gap-5 rounded-lg border border-gray-300 p-4">
          <div ref={qrRef} className="rounded-lg bg-white p-2">
            <QRCodeCanvas value={link} size={104} level="M" marginSize={0} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">QR code</p>
            <p className="mt-0.5 text-xs text-gray-500">
              Print it or add it to a flyer. Scanning opens the survey.
            </p>
            <button onClick={downloadQr} className="btn-secondary mt-3 py-2 text-sm">
              Download QR
            </button>
          </div>
        </div>

        {/* Email */}
        <div className="mt-5">
          <label className="label">Invite by email</label>
          <div className="flex gap-2">
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
            />
            <button onClick={addEntry} type="button" className="btn-secondary shrink-0">
              Add
            </button>
          </div>
          {emails.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {emails.map((em) => (
                <span
                  key={em}
                  className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700"
                >
                  {em}
                  <button
                    onClick={() => setEmails((list) => list.filter((x) => x !== em))}
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
            The invite email carries the survey link and our logo. It sends in the
            background.
          </p>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary py-2.5">
            Close
          </button>
          <button onClick={sendEmails} disabled={isLoading} className="btn-primary py-2.5">
            {isLoading ? "Sending..." : "Send invites"}
          </button>
        </div>
      </div>
    </div>
  );
}
