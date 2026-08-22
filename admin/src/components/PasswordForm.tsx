import { useState, type FormEvent } from "react";
import { useChangePasswordMutation } from "../store/endpoints/profileApi";
import { showSuccess, showError } from "../lib/toast";
import { required, password as validatePassword, isClean } from "../lib/validation";
import { EyeIcon, EyeOffIcon } from "./icons";

/**
 * Changing your own password. Used on its own page from the profile, and as a
 * tab in settings, so everyone has it wherever they look for it.
 */
export default function PasswordForm({ onDone }: { onDone?: () => void }) {
  const [changePassword, { isLoading: saving }] = useChangePasswordMutation();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string | null> = {
      currentPassword: required(currentPassword, "Current password"),
      newPassword: validatePassword(newPassword, "New password"),
      confirmPassword:
        confirmPassword === ""
          ? "Please confirm your new password."
          : newPassword !== confirmPassword
            ? "Passwords do not match."
            : null,
    };
    setErrors(next);
    if (!isClean(next)) return;
    try {
      await changePassword({ currentPassword, newPassword }).unwrap();
      showSuccess("Password changed. Use it next time you sign in.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      onDone?.();
    } catch (err) {
      showError(
        (err as { message?: string })?.message ??
          "Something went wrong. Please try again."
      );
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <p className="text-xs text-gray-500">
        Fields marked <span className="text-danger">*</span> are required.
      </p>

      <div>
        <label htmlFor="current" className="label">
          Current password <span className="text-danger">*</span>
        </label>
        <input
          id="current"
          type="password"
          className={`input-field ${errors.currentPassword ? "input-error" : ""}`}
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          maxLength={64}
        />
        {errors.currentPassword && (
          <p className="field-error">{errors.currentPassword}</p>
        )}
      </div>

      <div>
        <label htmlFor="new" className="label">
          New password <span className="text-danger">*</span>
        </label>
        <div className="relative">
          <input
            id="new"
            type={show ? "text" : "password"}
            className={`input-field pr-11 ${errors.newPassword ? "input-error" : ""}`}
            placeholder="At least 8 characters"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            maxLength={64}
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute inset-y-0 right-0 grid w-11 place-items-center text-gray-500 hover:text-gray-700"
            aria-label={show ? "Hide password" : "Show password"}
          >
            {show ? (
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

      <div>
        <label htmlFor="confirm" className="label">
          Confirm new password <span className="text-danger">*</span>
        </label>
        <input
          id="confirm"
          type="password"
          className={`input-field ${errors.confirmPassword ? "input-error" : ""}`}
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            if (errors.confirmPassword) {
              setErrors((prev) => ({ ...prev, confirmPassword: null }));
            }
          }}
          maxLength={64}
        />
        {errors.confirmPassword && (
          <p className="field-error">{errors.confirmPassword}</p>
        )}
      </div>

      <div className="flex justify-end pt-2">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Saving..." : "Change password"}
        </button>
      </div>
    </form>
  );
}
