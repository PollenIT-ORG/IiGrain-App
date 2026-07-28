import { useState, type FormEvent } from "react";
import { showSuccess, showError } from "../../lib/toast";
import {
  requiredEmail,
  password as validatePassword,
  isClean,
} from "../../lib/validation";
import {
  useForgotPasswordMutation,
  useResetPasswordMutation,
} from "../../store/endpoints/authApi";
import { EyeIcon, EyeOffIcon } from "../icons";

type Step = "email" | "reset" | "done";

interface ForgotPasswordFormProps {
  onBackToLogin: () => void;
  initialEmail?: string;
}

function errMsg(err: unknown): string {
  return (
    (err as { message?: string })?.message ??
    "Something went wrong. Please try again."
  );
}

export default function ForgotPasswordForm({
  onBackToLogin,
  initialEmail = "",
}: ForgotPasswordFormProps) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const [forgotPassword, { isLoading: requesting }] =
    useForgotPasswordMutation();
  const [resetPassword, { isLoading: resetting }] = useResetPasswordMutation();
  const loading = requesting || resetting;

  async function handleRequest(e: FormEvent) {
    e.preventDefault();
    const next = { email: requiredEmail(email) };
    setErrors(next);
    if (!isClean(next)) return;
    try {
      await forgotPassword({ email: email.trim() }).unwrap();
      showSuccess("Verification code sent. Check your email.");
      setStep("reset");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  async function handleReset(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string | null> = {
      code: code.trim().length === 6 ? null : "Enter the 6-digit code.",
      newPassword: validatePassword(newPassword, "New password"),
    };
    setErrors(next);
    if (!isClean(next)) return;
    try {
      await resetPassword({
        email: email.trim(),
        code: code.trim(),
        newPassword,
      }).unwrap();
      showSuccess("Password updated. You can sign in now.");
      setStep("done");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  return (
    <div className="card p-7 sm:p-9 lg:border-0 lg:shadow-none">
      <header className="mb-7">
        <h2 className="text-2xl font-bold text-gray-900">
          {step === "done" ? "Password updated" : "Reset password"}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          {step === "email" &&
            "Enter your email and we'll send a verification code."}
          {step === "reset" &&
            "Enter the code we sent and choose a new password."}
          {step === "done" &&
            "Your password has been changed. Sign in with the new one."}
        </p>
      </header>

      {step !== "done" && (
        <div className="mb-6 flex items-center gap-2">
          <StepDot active label="1" done={step === "reset"} />
          <span className="h-px flex-1 bg-gray-300" />
          <StepDot active={step === "reset"} label="2" />
        </div>
      )}

      {step === "email" && (
        <form onSubmit={handleRequest} className="space-y-5" noValidate>
          <div>
            <label htmlFor="fp-email" className="label">
              Email address
            </label>
            <input
              id="fp-email"
              type="email"
              autoComplete="email"
              className={`input-field ${errors.email ? "input-error" : ""}`}
              placeholder="admin@farmerapp.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {errors.email && <p className="field-error">{errors.email}</p>}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3 text-base"
          >
            {loading ? "Sending..." : "Send code"}
          </button>
        </form>
      )}

      {step === "reset" && (
        <form onSubmit={handleReset} className="space-y-5" noValidate>
          <div>
            <label htmlFor="fp-code" className="label">
              Verification code
            </label>
            <input
              id="fp-code"
              inputMode="numeric"
              className={`input-field tracking-[0.3em] ${
                errors.code ? "input-error" : ""
              }`}
              placeholder="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              maxLength={6}
            />
            {errors.code ? (
              <p className="field-error">{errors.code}</p>
            ) : (
              <p className="mt-1.5 text-xs text-gray-500">
                Sent to <span className="font-medium text-gray-700">{email}</span>.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="fp-new" className="label">
              New password
            </label>
            <div className="relative">
              <input
                id="fp-new"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                className={`input-field pr-11 ${
                  errors.newPassword ? "input-error" : ""
                }`}
                placeholder="At least 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute inset-y-0 right-0 grid w-11 place-items-center text-gray-500 hover:text-gray-700"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOffIcon width={18} height={18} />
                ) : (
                  <EyeIcon width={18} height={18} />
                )}
              </button>
            </div>
            {errors.newPassword ? (
              <p className="field-error">{errors.newPassword}</p>
            ) : (
              <p className="mt-1.5 text-xs text-gray-500">
                At least 8 characters, with one letter and one number.
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3 text-base"
          >
            {loading ? "Updating..." : "Reset password"}
          </button>

          <button
            type="button"
            onClick={() => setStep("email")}
            className="w-full text-center text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            Didn't get a code? Try again
          </button>
        </form>
      )}

      {step === "done" && (
        <button
          onClick={onBackToLogin}
          className="btn-primary w-full py-3 text-base"
        >
          Back to sign in
        </button>
      )}

      {step !== "done" && (
        <button
          onClick={onBackToLogin}
          className="mt-6 w-full text-center text-sm font-medium text-primary hover:text-primary-dark"
        >
          ← Back to sign in
        </button>
      )}
    </div>
  );
}

function StepDot({
  active,
  done,
  label,
}: {
  active?: boolean;
  done?: boolean;
  label: string;
}) {
  return (
    <span
      className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${
        done || active
          ? "bg-primary text-white"
          : "bg-gray-300 text-gray-700"
      }`}
    >
      {label}
    </span>
  );
}
