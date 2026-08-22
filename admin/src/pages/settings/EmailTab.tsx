import { useEffect, useState, type FormEvent } from "react";
import {
  useGetEmailSettingsQuery,
  useSaveEmailSettingsMutation,
  useSendTestEmailMutation,
  type EmailProvider,
} from "../../store/endpoints/emailSettingsApi";
import { errMsg } from "../../lib/errMsg";
import { showSuccess, showError } from "../../lib/toast";
import Select from "../../components/ui/Select";
import Loader from "../../components/Loader";

// Where the platform's email goes out from, set here rather than in a file on
// the server. Two providers can be filled in at once: one is tried first and
// the other covers for it, so a provider refusing a message - an exhausted
// allowance, a blocked port - does not stop people being emailed.

const PROVIDERS = [
  { value: "smtp", label: "SMTP server" },
  { value: "resend", label: "Resend API" },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const HOST_RE = /^[a-zA-Z0-9.-]+$/;

export default function EmailTab() {
  const { data, isLoading, isError, error } = useGetEmailSettingsQuery();
  const [save, { isLoading: saving }] = useSaveEmailSettingsMutation();
  const [test, { isLoading: testing }] = useSendTestEmailMutation();

  const [primary, setPrimary] = useState<EmailProvider>("smtp");
  const [fallback, setFallback] = useState(true);
  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [smtpEnabled, setSmtpEnabled] = useState(false);
  const [host, setHost] = useState("");
  const [port, setPort] = useState("587");
  const [secure, setSecure] = useState(false);
  const [user, setUser] = useState("");
  // Blank means "keep what is stored" - the stored one is never sent here.
  const [pass, setPass] = useState("");
  const [resendEnabled, setResendEnabled] = useState(false);
  const [resendKey, setResendKey] = useState("");
  const [testTo, setTestTo] = useState("");
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  // What Resend has to have verified before it will send anything.
  const senderDomain = fromEmail.includes("@") ? fromEmail.split("@")[1] : "";

  useEffect(() => {
    if (!data) return;
    setPrimary(data.primaryProvider);
    setFallback(data.fallbackEnabled);
    setFromName(data.fromName);
    setFromEmail(data.fromEmail);
    setSmtpEnabled(data.smtpEnabled);
    setHost(data.smtpHost);
    setPort(String(data.smtpPort));
    setSecure(data.smtpSecure);
    setUser(data.smtpUser);
    setResendEnabled(data.resendEnabled);
    setPass("");
    setResendKey("");
  }, [data]);

  function validate(): boolean {
    const next: Record<string, string | null> = {};
    if (!fromName.trim()) next.fromName = "Sender name is required.";
    if (!EMAIL_RE.test(fromEmail.trim()))
      next.fromEmail = "Enter a valid email address.";
    if (smtpEnabled) {
      if (!host.trim()) next.host = "SMTP host is required.";
      else if (!HOST_RE.test(host.trim()))
        next.host = "Enter the server name only, e.g. smtp.example.com.";
      const p = Number(port);
      if (!Number.isInteger(p) || p < 1 || p > 65535)
        next.port = "Port must be between 1 and 65535.";
      if (!data?.smtpPassSet && !pass)
        next.pass = "Enter the password for this account.";
    }
    if (resendEnabled && !data?.resendKeySet && !resendKey.trim())
      next.resendKey = "Enter the Resend API key.";
    if (primary === "smtp" && !smtpEnabled)
      next.primary = "Turn SMTP on to send through it first.";
    if (primary === "resend" && !resendEnabled)
      next.primary = "Turn Resend on to send through it first.";
    setErrors(next);
    return Object.values(next).every((v) => !v);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    try {
      await save({
        primaryProvider: primary,
        fallbackEnabled: fallback,
        fromName: fromName.trim(),
        fromEmail: fromEmail.trim(),
        smtpEnabled,
        smtpHost: host.trim(),
        smtpPort: Number(port),
        smtpSecure: secure,
        smtpUser: user.trim(),
        // Only sent when it was typed, so saving does not wipe what is stored.
        ...(pass ? { smtpPass: pass } : {}),
        resendEnabled,
        ...(resendKey.trim() ? { resendApiKey: resendKey.trim() } : {}),
      }).unwrap();
      setPass("");
      setResendKey("");
      showSuccess("Email settings saved.");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  async function handleTest(provider?: EmailProvider) {
    const to = testTo.trim();
    if (!EMAIL_RE.test(to)) {
      setErrors((e) => ({ ...e, testTo: "Enter a valid email address." }));
      return;
    }
    setErrors((e) => ({ ...e, testTo: null }));
    try {
      const res = await test({ to, provider }).unwrap();
      showSuccess(
        `Test email sent to ${to} via ${res.provider === "resend" ? "Resend" : "SMTP"}.`
      );
    } catch (err) {
      // The provider's own words - "allowance exhausted", "sender not
      // verified" - are the whole point of testing.
      showError(errMsg(err));
    }
  }

  if (isLoading) return <Loader message="Loading email settings..." />;
  if (isError) {
    return (
      <div className="card px-5 py-16 text-center text-sm text-gray-500">
        {errMsg(error)}
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-5" noValidate>
      <div className="card space-y-5 p-6 sm:p-8">
        <div>
          <h2 className="text-base font-bold text-gray-900">Email</h2>
          <p className="mt-1 text-sm text-gray-500">
            Where every message from the platform is sent from. Credentials are
            stored encrypted and never shown again.
          </p>
        </div>

        {data?.usingEnvFallback && (
          <div className="rounded-lg border border-info/30 bg-info/5 p-4 text-sm text-gray-700">
            Nothing is set up here yet, so the values from the server's own
            configuration are being used. Save this form to take over.
          </div>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="from-name">
              Sender name <span className="text-danger">*</span>
            </label>
            <input
              id="from-name"
              className={`input-field ${errors.fromName ? "input-error" : ""}`}
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              maxLength={120}
              placeholder="iiGrain"
            />
            {errors.fromName && <p className="field-error">{errors.fromName}</p>}
          </div>
          <div>
            <label className="label" htmlFor="from-email">
              Sender address <span className="text-danger">*</span>
            </label>
            <input
              id="from-email"
              className={`input-field ${errors.fromEmail ? "input-error" : ""}`}
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              maxLength={200}
              placeholder="no-reply@example.com"
            />
            {errors.fromEmail && (
              <p className="field-error">{errors.fromEmail}</p>
            )}
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="label">Send through</label>
            <Select
              value={primary}
              onChange={(v) => setPrimary(v as EmailProvider)}
              options={PROVIDERS}
            />
            {errors.primary && <p className="field-error">{errors.primary}</p>}
          </div>
          <div>
            <label className="label">If it fails</label>
            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-gray-300 p-3">
              <input
                type="checkbox"
                checked={fallback}
                onChange={(e) => setFallback(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-primary"
              />
              <span className="text-sm text-gray-700">
                Try the other one
                <span className="block text-xs text-gray-500">
                  The message goes out through whichever will take it.
                </span>
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* --------------------------------- SMTP -------------------------- */}
      <div className="card space-y-5 p-6 sm:p-8">
        <label className="flex cursor-pointer items-center justify-between gap-4">
          <span>
            <span className="block text-base font-bold text-gray-900">
              SMTP server
            </span>
            <span className="block text-sm text-gray-500">
              Your own mail server or a relay such as SMTP2GO.
            </span>
          </span>
          <input
            type="checkbox"
            checked={smtpEnabled}
            onChange={(e) => setSmtpEnabled(e.target.checked)}
            className="h-5 w-5 shrink-0 accent-primary"
          />
        </label>

        {smtpEnabled && (
          <>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="smtp-host">
                  Host <span className="text-danger">*</span>
                </label>
                <input
                  id="smtp-host"
                  className={`input-field ${errors.host ? "input-error" : ""}`}
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  maxLength={200}
                  placeholder="smtp.example.com"
                />
                {errors.host && <p className="field-error">{errors.host}</p>}
              </div>
              <div>
                <label className="label" htmlFor="smtp-port">
                  Port <span className="text-danger">*</span>
                </label>
                <input
                  id="smtp-port"
                  className={`input-field ${errors.port ? "input-error" : ""}`}
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  inputMode="numeric"
                  maxLength={5}
                  placeholder="587"
                />
                {errors.port && <p className="field-error">{errors.port}</p>}
              </div>
            </div>

            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                checked={secure}
                onChange={(e) => setSecure(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-primary"
              />
              <span className="text-sm text-gray-700">
                Connect over TLS from the start
                <span className="block text-xs text-gray-500">
                  For port 465. On 587 leave this off - the connection is
                  upgraded with STARTTLS.
                </span>
              </span>
            </label>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="smtp-user">
                  Username
                </label>
                <input
                  id="smtp-user"
                  className="input-field"
                  value={user}
                  onChange={(e) => setUser(e.target.value)}
                  maxLength={200}
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="label" htmlFor="smtp-pass">
                  Password
                </label>
                <input
                  id="smtp-pass"
                  type="password"
                  className={`input-field ${errors.pass ? "input-error" : ""}`}
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  maxLength={300}
                  autoComplete="new-password"
                  placeholder={
                    data?.smtpPassSet
                      ? `Saved (${data.smtpPassHint ?? "••••"})`
                      : "Enter the password"
                  }
                />
                {errors.pass ? (
                  <p className="field-error">{errors.pass}</p>
                ) : (
                  data?.smtpPassSet && (
                    <p className="mt-1.5 text-xs text-gray-500">
                      Leave blank to keep the saved password.
                    </p>
                  )
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* -------------------------------- Resend ------------------------- */}
      <div className="card space-y-5 p-6 sm:p-8">
        <label className="flex cursor-pointer items-center justify-between gap-4">
          <span>
            <span className="block text-base font-bold text-gray-900">
              Resend API
            </span>
            <span className="block text-sm text-gray-500">
              Sends over HTTPS, so it works where SMTP ports are blocked.
            </span>
          </span>
          <input
            type="checkbox"
            checked={resendEnabled}
            onChange={(e) => setResendEnabled(e.target.checked)}
            className="h-5 w-5 shrink-0 accent-primary"
          />
        </label>

        {resendEnabled && (
          <div>
            <label className="label" htmlFor="resend-key">
              API key
            </label>
            <input
              id="resend-key"
              type="password"
              className={`input-field ${errors.resendKey ? "input-error" : ""}`}
              value={resendKey}
              onChange={(e) => setResendKey(e.target.value)}
              maxLength={300}
              autoComplete="off"
              placeholder={
                data?.resendKeySet
                  ? `Saved (${data.resendKeyHint ?? "••••"})`
                  : "re_..."
              }
            />
            {errors.resendKey && (
              <p className="field-error">{errors.resendKey}</p>
            )}
            {/* Resend refuses any address whose domain is not verified with
                them, so the sender above has to match one that is. */}
            <p className="mt-1.5 text-xs text-gray-500">
              {data?.resendKeySet ? "Leave blank to keep the saved key. " : ""}
              Resend only sends from a domain verified with them
              {senderDomain ? (
                <>
                  {" "}
                  - verify <span className="font-medium">{senderDomain}</span> at{" "}
                  <a
                    href="https://resend.com/domains"
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-primary hover:underline"
                  >
                    resend.com/domains
                  </a>
                </>
              ) : null}
              .
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button className="btn-primary" disabled={saving} type="submit">
          {saving ? "Saving..." : "Save email settings"}
        </button>
      </div>

      {/* --------------------------------- Test -------------------------- */}
      <div className="card space-y-4 p-6 sm:p-8">
        <div>
          <h2 className="text-base font-bold text-gray-900">Send a test</h2>
          <p className="mt-1 text-sm text-gray-500">
            Credentials that sign in can still refuse to send, so the only real
            check is one message. Whatever the provider answers is shown here.
          </p>
        </div>
        <div>
          <label className="label" htmlFor="test-to">
            Send to
          </label>
          <input
            id="test-to"
            className={`input-field ${errors.testTo ? "input-error" : ""}`}
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            maxLength={200}
            placeholder="you@example.com"
          />
          {errors.testTo && <p className="field-error">{errors.testTo}</p>}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="btn-secondary"
            disabled={testing || !data?.smtpEnabled}
            onClick={() => handleTest("smtp")}
          >
            Test SMTP
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={testing || !data?.resendEnabled}
            onClick={() => handleTest("resend")}
          >
            Test Resend
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={testing}
            onClick={() => handleTest()}
          >
            {testing ? "Sending..." : "Send as the platform would"}
          </button>
        </div>
      </div>
    </form>
  );
}
