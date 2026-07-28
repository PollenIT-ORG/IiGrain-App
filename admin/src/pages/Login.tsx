import { useState, useEffect, type FormEvent } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { showSuccess, showError, showInfo } from "../lib/toast";
import { requiredEmail, required, isClean } from "../lib/validation";
import { useAppDispatch } from "../store/hooks";
import { setCredentials } from "../store/authSlice";
import { useLoginMutation } from "../store/endpoints/authApi";
import Logo from "../components/Logo";
import ForgotPasswordForm from "../components/auth/ForgotPasswordForm";
import { EyeIcon, EyeOffIcon } from "../components/icons";
import { canUseAdminPanel } from "../types";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const [loginMutation, { isLoading: loading }] = useLoginMutation();

  const [view, setView] = useState<"login" | "forgot">("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const from =
    (location.state as { from?: string } | null)?.from ?? "/dashboard";

  useEffect(() => {
    if (sessionStorage.getItem("session_expired")) {
      sessionStorage.removeItem("session_expired");
      showInfo("Your session expired. Please sign in again.");
    }
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const next = {
      email: requiredEmail(email),
      password: required(password, "Password"),
    };
    setErrors(next);
    if (!isClean(next)) return;
    try {
      const data = await loginMutation({
        email: email.trim(),
        password,
      }).unwrap();

      if (!canUseAdminPanel(data.user.role)) {
        showError("Access denied. This panel is for administrators only.");
        return;
      }

      dispatch(setCredentials(data));
      showSuccess("Signed in successfully.");
      navigate(from, { replace: true });
    } catch (err) {
      const message =
        (err as { message?: string })?.message ??
        "Something went wrong. Please try again.";
      showError(message);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo size="md" />
        </div>

        {view === "forgot" ? (
          <ForgotPasswordForm
            initialEmail={email}
            onBackToLogin={() => setView("login")}
          />
        ) : (
          <div className="card p-7 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div>
                <label htmlFor="email" className="label">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  className={`input-field ${errors.email ? "input-error" : ""}`}
                  placeholder="admin@farmerapp.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  maxLength={255}
                />
                {errors.email && <p className="field-error">{errors.email}</p>}
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label htmlFor="password" className="label mb-0">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setView("forgot")}
                    className="text-xs font-medium text-primary hover:text-primary-dark"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    className={`input-field pr-11 ${
                      errors.password ? "input-error" : ""
                    }`}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    maxLength={64}
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
                {errors.password && (
                  <p className="field-error">{errors.password}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full py-3 text-base"
              >
                {loading ? "Signing in..." : "Sign in"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
