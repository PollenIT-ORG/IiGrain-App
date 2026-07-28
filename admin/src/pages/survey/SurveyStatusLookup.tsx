import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import SurveyLayout, { type SurveyStep } from "./SurveyLayout";
import { surveyApi, SurveyApiError } from "../../lib/surveyApi";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const STEPS: SurveyStep[] = [
  { key: "lookup", title: "Check status", note: "Enter your email" },
];

export default function SurveyStatusLookup() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    setError(null);
    setLoading(true);
    const value = email.trim().toLowerCase();
    try {
      const res = await surveyApi.checkEmail(value);
      if (res.state === "submitted" && res.statusToken) {
        navigate(`/survey/status/${res.statusToken}`);
      } else if (res.state === "draft") {
        // Not finished yet - take them back to the survey to resume.
        navigate(`/survey?email=${encodeURIComponent(value)}`);
      } else {
        setLoading(false);
        setError("We could not find a survey for that email. Please check it and try again.");
      }
    } catch (err) {
      setLoading(false);
      setError(
        err instanceof SurveyApiError
          ? err.message
          : "Could not check your status. Please try again."
      );
    }
  }

  return (
    <SurveyLayout steps={STEPS} activeStep="lookup" completedCount={0} totalCount={0}>
      <div className="mx-auto max-w-md">
        <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">
          Check your status
        </h1>
        <p className="mt-2 text-gray-700">
          Enter the email you used for the survey and we will take you to your
          application status.
        </p>
        <form onSubmit={handleSubmit} className="card mt-6 p-6 sm:p-8" noValidate>
          <label htmlFor="email" className="label">
            Email address
          </label>
          <input
            id="email"
            type="email"
            className={`input-field ${error ? "input-error" : ""}`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          {error && <p className="field-error">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary mt-6 w-full"
          >
            {loading ? "Checking..." : "Check status"}
          </button>
        </form>
      </div>
    </SurveyLayout>
  );
}
