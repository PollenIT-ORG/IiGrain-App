import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useChangePasswordMutation } from "../store/endpoints/profileApi";
import { showSuccess, showError } from "../lib/toast";
import { required, password as validatePassword, isClean } from "../lib/validation";
import { EyeIcon, EyeOffIcon, ChevronLeftIcon } from "../components/icons";

export default function ChangePassword() {
  const navigate = useNavigate();
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
      navigate("/profile");
    } catch (err) {
      const message =
        (err as { message?: string })?.message ??
        "Something went wrong. Please try again.";
      showError(message);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <button
          onClick={() => navigate("/profile")}
          className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-primary"
        >
          <ChevronLeftIcon width={16} height={16} />
          Back to profile
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Change password</h1>
        <p className="mt-1 text-sm text-gray-500">
          Enter your current password and choose a new one.
        </p>
      </div>

      <div className="card p-6 sm:p-8">
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
              className={`input-field ${
                errors.currentPassword ? "input-error" : ""
              }`}
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
                className={`input-field pr-11 ${
                  errors.newPassword ? "input-error" : ""
                }`}
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
              className={`input-field ${
                errors.confirmPassword ? "input-error" : ""
              }`}
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

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigate("/profile")}
            >
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Saving..." : "Change password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
