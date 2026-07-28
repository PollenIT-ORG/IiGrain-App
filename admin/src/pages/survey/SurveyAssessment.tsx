import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { showError, showSuccess } from "../../lib/toast";
import Select from "../../components/ui/Select";
import Loader from "../../components/Loader";
import SurveyLayout, { type SurveyStep } from "./SurveyLayout";
import { CategoryIcon } from "./SurveyIcons";
import { STATES, REFERRAL_SOURCES } from "./states";
import {
  surveyApi,
  SurveyApiError,
  type SurveyStructure,
  type SurveyCategoryNode,
} from "../../lib/surveyApi";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const STEPS: SurveyStep[] = [
  {
    key: "details",
    title: "Basic Farmer Details",
    note: "Provide a few details to get started",
  },
  {
    key: "categories",
    title: "Survey Categories",
    note: "Select a category to begin",
  },
  {
    key: "questions",
    title: "Survey Questions",
    note: "Answer questions in this category",
  },
  {
    key: "review",
    title: "Review & Submit",
    note: "Review your responses and submit",
  },
];

type Step = "details" | "categories" | "questions" | "review" | "done";

// Each score keeps its own colour on the answer cards - red (0) through green
// (3) - matching the mobile assessment so the scale reads the same everywhere.
const SCALE_STYLE = [
  { num: "text-danger", border: "border-danger", bg: "bg-danger/5", check: "bg-danger" },
  { num: "text-accent", border: "border-accent", bg: "bg-accent/5", check: "bg-accent" },
  { num: "text-info", border: "border-info", bg: "bg-info/5", check: "bg-info" },
  { num: "text-success", border: "border-success", bg: "bg-success/5", check: "bg-success" },
];
const scaleStyle = (v: number) => SCALE_STYLE[v] ?? SCALE_STYLE[SCALE_STYLE.length - 1];

interface Details {
  firstName: string;
  lastName: string;
  email: string;
  farmName: string;
  referralSource: string;
  state: string;
  totalAcres: string;
}

const EMPTY: Details = {
  firstName: "",
  lastName: "",
  email: "",
  farmName: "",
  referralSource: "",
  state: "",
  totalAcres: "",
};

export default function SurveyAssessment() {
  const [params] = useSearchParams();
  const [structure, setStructure] = useState<SurveyStructure | null>(null);
  const [loadError, setLoadError] = useState(false);

  const [step, setStep] = useState<Step>("details");
  const [details, setDetails] = useState<Details>(EMPTY);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [catIndex, setCatIndex] = useState(0);
  const [busy, setBusy] = useState(false);

  const [submittedToken, setSubmittedToken] = useState<string | null>(null);
  const [checkingEmail, setCheckingEmail] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        setStructure(await surveyApi.structure());
      } catch {
        setLoadError(true);
      }
    })();
  }, []);

  // If the producer arrived from a "check status" redirect for a draft, or via a
  // ?email= link, load their saved progress and jump straight into the survey.
  useEffect(() => {
    const prefill = params.get("email");
    if (!prefill || !EMAIL_RE.test(prefill)) return;
    setDetails((d) => ({ ...d, email: prefill }));
    void resumeFromEmail(prefill, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const categories = structure?.categories ?? [];
  const allQuestions = useMemo(
    () => categories.flatMap((c) => c.questions),
    [categories]
  );
  const answeredCount = allQuestions.filter(
    (q) => answers[q.id] !== undefined
  ).length;

  function set<K extends keyof Details>(k: K, v: Details[K]) {
    setDetails((d) => ({ ...d, [k]: v }));
    setErrors((e) => {
      const { [k]: _omit, ...rest } = e;
      return rest;
    });
  }

  function toDetailsPayload() {
    return {
      firstName: details.firstName.trim(),
      lastName: details.lastName.trim(),
      email: details.email.trim().toLowerCase(),
      farmName: details.farmName.trim() || null,
      referralSource: details.referralSource || null,
      state: details.state || null,
      totalAcres: details.totalAcres ? Number(details.totalAcres) : null,
    };
  }

  // Look up an email: resume a draft (straight into the survey), or flag a
  // completed submission. Returns true when a draft was resumed.
  async function resumeFromEmail(email: string, jump: boolean): Promise<boolean> {
    setCheckingEmail(true);
    try {
      const res = await surveyApi.checkEmail(email.trim().toLowerCase());
      if (res.state === "submitted") {
        setSubmittedToken(res.statusToken);
        return false;
      }
      if (res.state === "draft" && res.draft) {
        const d = res.draft;
        setDetails((prev) => ({
          ...prev,
          firstName: d.firstName ?? prev.firstName,
          lastName: d.lastName ?? prev.lastName,
          farmName: d.farmName ?? "",
          referralSource: d.referralSource ?? "",
          state: d.state ?? "",
          totalAcres: d.totalAcres ?? "",
        }));
        setAnswers(d.answers ?? {});
        setSubmittedToken(null);
        if (jump) {
          setStep("categories");
          showSuccess("Welcome back - resuming your survey.");
        }
        return true;
      }
      setSubmittedToken(null);
      return false;
    } catch {
      return false;
    } finally {
      setCheckingEmail(false);
    }
  }

  function validateDetails(): boolean {
    const e: Record<string, string> = {};
    if (!details.firstName.trim()) e.firstName = "First name is required.";
    if (!details.lastName.trim()) e.lastName = "Last name is required.";
    if (!details.email.trim()) e.email = "Email address is required.";
    else if (!EMAIL_RE.test(details.email.trim()))
      e.email = "Enter a valid email address.";
    if (!details.state) e.state = "Please choose your state.";
    const acres = Number(details.totalAcres);
    if (!details.totalAcres.trim()) e.totalAcres = "Total acres is required.";
    else if (Number.isNaN(acres) || acres <= 0)
      e.totalAcres = "Enter a number greater than zero.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function saveAndContinue(e: FormEvent) {
    e.preventDefault();
    if (submittedToken) return;
    if (!validateDetails()) {
      showError("Please complete the highlighted fields.");
      return;
    }
    setBusy(true);
    try {
      await surveyApi.saveDraft(toDetailsPayload(), answers);
      setStep("categories");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      handleApiError(err);
    } finally {
      setBusy(false);
    }
  }

  function answer(qId: string, value: number) {
    setAnswers((a) => ({ ...a, [qId]: value }));
  }

  async function persistDraft() {
    try {
      await surveyApi.saveDraft(toDetailsPayload(), answers);
    } catch {
      // Non-blocking.
    }
  }

  function openCategory(i: number) {
    setCatIndex(i);
    setStep("questions");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function nextFromQuestions() {
    const cat = categories[catIndex];
    const unanswered = cat.questions.filter((q) => answers[q.id] === undefined);
    if (unanswered.length) {
      showError("Please answer every question in this category.");
      return;
    }
    void persistDraft();
    if (catIndex < categories.length - 1) {
      setCatIndex((i) => i + 1);
    } else {
      setStep("categories");
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit() {
    const missing = allQuestions.filter((q) => answers[q.id] === undefined);
    if (missing.length) {
      showError("Please answer every question before submitting.");
      setStep("categories");
      return;
    }
    setBusy(true);
    try {
      const res = await surveyApi.submit(toDetailsPayload(), answers);
      setSubmittedToken(res.statusToken);
      setStep("done");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      handleApiError(err);
    } finally {
      setBusy(false);
    }
  }

  function handleApiError(err: unknown) {
    if (err instanceof SurveyApiError) {
      if (Object.keys(err.fieldErrors).length) setErrors(err.fieldErrors);
      showError(err.message);
      if (err.status === 409) {
        void (async () => {
          try {
            const { statusToken } = await surveyApi.lookupStatus(
              details.email.trim().toLowerCase()
            );
            setSubmittedToken(statusToken);
          } catch {
            // ignore
          }
        })();
      }
    } else {
      showError("Something went wrong. Please try again.");
    }
  }

  if (loadError) {
    return (
      <SurveyLayout steps={STEPS} activeStep="details" completedCount={0} totalCount={0}>
        <div className="card p-10 text-center text-gray-600">
          We could not load the survey right now. Please refresh the page.
        </div>
      </SurveyLayout>
    );
  }
  if (!structure) {
    return (
      <SurveyLayout steps={STEPS} activeStep="details" completedCount={0} totalCount={0}>
        <Loader message="Loading the survey..." />
      </SurveyLayout>
    );
  }

  const railKey =
    step === "done" ? "review" : step;

  return (
    <SurveyLayout
      steps={STEPS}
      activeStep={railKey}
      completedCount={answeredCount}
      totalCount={allQuestions.length}
    >
      {step === "details" && (
        <DetailsStep
          details={details}
          errors={errors}
          set={set}
          onEmailBlur={() => {
            const email = details.email.trim().toLowerCase();
            if (EMAIL_RE.test(email)) void resumeFromEmail(email, true);
          }}
          submittedToken={submittedToken}
          busy={busy}
          checkingEmail={checkingEmail}
          onSubmit={saveAndContinue}
        />
      )}

      {step === "categories" && (
        <CategoriesStep
          categories={categories}
          answers={answers}
          onOpen={openCategory}
          onReview={() => setStep("review")}
          onEditDetails={() => setStep("details")}
        />
      )}

      {step === "questions" && (
        <QuestionsStep
          category={categories[catIndex]}
          index={catIndex}
          total={categories.length}
          scaleLabels={structure.scaleLabels}
          answers={answers}
          onAnswer={answer}
          onBack={() => {
            void persistDraft();
            setStep("categories");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          onNext={nextFromQuestions}
        />
      )}

      {step === "review" && (
        <ReviewStep
          categories={categories}
          answers={answers}
          scaleLabels={structure.scaleLabels}
          busy={busy}
          onBack={() => setStep("categories")}
          onEdit={openCategory}
          onSubmit={submit}
        />
      )}

      {step === "done" && (
        <DoneStep email={details.email.trim().toLowerCase()} statusToken={submittedToken} />
      )}
    </SurveyLayout>
  );
}

// ---------------------------------------------------------------------------

function DetailsStep({
  details,
  errors,
  set,
  onEmailBlur,
  submittedToken,
  busy,
  checkingEmail,
  onSubmit,
}: {
  details: Details;
  errors: Record<string, string>;
  set: <K extends keyof Details>(k: K, v: Details[K]) => void;
  onEmailBlur: () => void;
  submittedToken: string | null;
  busy: boolean;
  checkingEmail: boolean;
  onSubmit: (e: FormEvent) => void;
}) {
  return (
    <div className="card overflow-hidden">
      {/* Hero - the farm photo bleeds in from the right and melts into white
          under the heading. */}
      <div className="relative min-h-[190px] sm:min-h-[220px]">
        <img
          src="/survey_img.png"
          alt="Farm field at sunset"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#fff_0%,#fff_40%,rgba(255,255,255,0.55)_58%,rgba(255,255,255,0)_80%)]" />

        <div className="relative px-6 py-9 sm:px-8 sm:py-12">
          <h1 className="max-w-md text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
            Program Eligibility Survey
          </h1>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-gray-700">
            Answer a few simple questions about your operation. Your responses
            help us determine your eligibility for the regenerative agriculture
            program.
          </p>
        </div>
      </div>

      <form
        onSubmit={onSubmit}
        className="relative z-10 -mt-6 rounded-t-[1.75rem] bg-white p-6 pt-8 sm:p-8 sm:pt-10"
        noValidate
      >
        <div className="flex items-center gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-white">
            1
          </span>
          <h2 className="text-xl font-bold text-gray-900">Basic Farmer Details</h2>
        </div>
        <p className="mt-2 text-sm text-gray-600">
          Please provide some basic information to begin.
        </p>
        <p className="mt-1 text-xs text-gray-500">
          All fields marked <span className="text-danger">*</span> are required.
        </p>

        {submittedToken && (
          <div className="mt-5 rounded-lg border border-info/30 bg-info/5 p-4 text-sm text-gray-700">
            This email has already completed the survey.{" "}
            <Link
              to={`/survey/status/${submittedToken}`}
              className="font-semibold text-primary hover:underline"
            >
              Check your status
            </Link>
            .
          </div>
        )}

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Field label="First name" required error={errors.firstName}>
            <input
              className={`input-field ${errors.firstName ? "input-error" : ""}`}
              value={details.firstName}
              onChange={(e) => set("firstName", e.target.value)}
              placeholder="Enter first name"
            />
          </Field>
          <Field label="Last name" required error={errors.lastName}>
            <input
              className={`input-field ${errors.lastName ? "input-error" : ""}`}
              value={details.lastName}
              onChange={(e) => set("lastName", e.target.value)}
              placeholder="Enter last name"
            />
          </Field>
          <Field
            label="Email address"
            required
            error={errors.email}
            hint={
              checkingEmail
                ? "Checking your email..."
                : "Use the same email to save and resume any time."
            }
          >
            <div className="relative">
              <input
                type="email"
                className={`input-field ${errors.email ? "input-error" : ""} ${
                  checkingEmail ? "pr-10" : ""
                }`}
                value={details.email}
                onChange={(e) => set("email", e.target.value)}
                onBlur={onEmailBlur}
                placeholder="Enter email address"
              />
              {checkingEmail && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  <svg
                    className="h-5 w-5 animate-spin text-primary"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
                  </svg>
                </span>
              )}
            </div>
          </Field>
          <Field label="State" required error={errors.state}>
            <Select
              value={details.state}
              onChange={(v) => set("state", v)}
              error={Boolean(errors.state)}
              placeholder="Select your state"
              options={STATES.map((s) => ({ value: s, label: s }))}
            />
          </Field>
          <Field label="Approximate total acres" required error={errors.totalAcres}>
            <input
              type="number"
              min="0"
              className={`input-field ${errors.totalAcres ? "input-error" : ""}`}
              value={details.totalAcres}
              onChange={(e) => set("totalAcres", e.target.value)}
              placeholder="Enter total acres"
            />
          </Field>
          <Field label="Farm or business name" optional>
            <input
              className="input-field"
              value={details.farmName}
              onChange={(e) => set("farmName", e.target.value)}
              placeholder="Enter farm or business name (optional)"
            />
          </Field>
          <Field label="Referral source" optional>
            <Select
              value={details.referralSource}
              onChange={(v) => set("referralSource", v)}
              placeholder="How did you hear about us?"
              options={REFERRAL_SOURCES.map((s) => ({ value: s, label: s }))}
            />
          </Field>
        </div>

        <div className="mt-7 flex items-center justify-between">
          <Link
            to="/survey/status"
            className="text-sm font-medium text-gray-500 hover:text-primary"
          >
            Already started? Check your status
          </Link>
          <button
            type="submit"
            disabled={busy || checkingEmail || Boolean(submittedToken)}
            className="btn-primary disabled:opacity-60"
          >
            {busy
              ? "Saving..."
              : checkingEmail
                ? "Checking..."
                : "Save & continue"}
          </button>
        </div>
      </form>
    </div>
  );
}

function CategoriesStep({
  categories,
  answers,
  onOpen,
  onReview,
  onEditDetails,
}: {
  categories: SurveyCategoryNode[];
  answers: Record<string, number>;
  onOpen: (i: number) => void;
  onReview: () => void;
  onEditDetails: () => void;
}) {
  const allDone = categories.every((c) =>
    c.questions.every((q) => answers[q.id] !== undefined)
  );

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-gray-300/70 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Survey categories</h2>
          <p className="mt-1 text-sm text-gray-500">
            The survey is divided into these categories. Open each one and answer
            its questions - your progress is saved automatically.
          </p>
        </div>
        <button
          onClick={onEditDetails}
          className="shrink-0 text-sm font-medium text-gray-500 hover:text-primary"
        >
          Edit details
        </button>
      </div>

      <div className="grid gap-4 p-6 sm:grid-cols-2 sm:p-8 lg:grid-cols-3">
        {categories.map((c, i) => {
          const answered = c.questions.filter(
            (q) => answers[q.id] !== undefined
          ).length;
          const done = answered === c.questions.length && c.questions.length > 0;
          return (
            <button
              key={c.id}
              onClick={() => onOpen(i)}
              className={`flex flex-col rounded-xl border p-5 text-left transition-colors ${
                done
                  ? "border-primary/40 bg-primary/5"
                  : "border-gray-300 bg-white hover:border-primary/40 hover:bg-gray-100"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
                  <CategoryIcon icon={c.icon} width={22} height={22} />
                </span>
                {done && (
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-primary text-white">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </span>
                )}
              </div>
              <p className="mt-3 font-semibold text-gray-900">
                {i + 1}. {c.name}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {answered} of {c.questions.length} answered
              </p>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between border-t border-gray-300/70 p-6 sm:p-8">
        <p className="text-sm text-gray-500">
          {allDone
            ? "All categories answered. You can review and submit."
            : "Answer every category to continue."}
        </p>
        <button onClick={onReview} disabled={!allDone} className="btn-primary disabled:opacity-60">
          Review & submit
        </button>
      </div>
    </div>
  );
}

function QuestionsStep({
  category,
  index,
  total,
  scaleLabels,
  answers,
  onAnswer,
  onBack,
  onNext,
}: {
  category: SurveyCategoryNode;
  index: number;
  total: number;
  scaleLabels: string[];
  answers: Record<string, number>;
  onAnswer: (id: string, v: number) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const answered = category.questions.filter(
    (q) => answers[q.id] !== undefined
  ).length;
  const pct = category.questions.length
    ? Math.round((answered / category.questions.length) * 100)
    : 0;

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-gray-300/70 p-6 sm:p-8">
        <button
          onClick={onBack}
          className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-primary"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
          Back to categories
        </button>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
              <CategoryIcon icon={category.icon} width={24} height={24} />
            </span>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {index + 1}. {category.name}
              </h2>
              {category.description && (
                <p className="mt-0.5 max-w-lg text-sm text-gray-500">
                  {category.description}
                </p>
              )}
            </div>
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Category progress
            </p>
            <p className="mt-1 text-sm text-gray-700">
              {answered} of {category.questions.length}
              <span className="ml-2 text-gray-400">{pct}%</span>
            </p>
          </div>
        </div>
      </div>

      <div className="divide-y divide-gray-300/60">
        {category.questions.map((q, i) => (
          <div key={q.id} className="p-6 sm:p-8">
            <p className="flex gap-3 font-medium text-gray-900">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-gray-100 text-xs font-bold text-gray-500">
                {i + 1}
              </span>
              <span>{q.question_text}</span>
            </p>
            {q.help_text && (
              <p className="ml-9 mt-1 text-sm text-gray-500">{q.help_text}</p>
            )}
            <div className="ml-9 mt-4 grid grid-cols-2 gap-3">
              {scaleLabels.map((label, value) => {
                const active = answers[q.id] === value;
                const c = scaleStyle(value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onAnswer(q.id, value)}
                    className={`relative rounded-2xl border p-4 text-center transition-colors ${
                      active
                        ? `${c.border} ${c.bg}`
                        : "border-gray-300 bg-white hover:bg-gray-100"
                    }`}
                  >
                    {active && (
                      <span
                        className={`absolute right-2.5 top-2.5 grid h-6 w-6 place-items-center rounded-full text-white ${c.check}`}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      </span>
                    )}
                    <span className={`block text-2xl font-extrabold ${c.num}`}>
                      {value}
                    </span>
                    <span className="mt-1 block text-sm font-semibold text-gray-900">
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-gray-300/70 p-6 sm:p-8">
        <button onClick={onBack} className="btn-secondary">
          Categories
        </button>
        <span className="text-sm text-gray-500">
          Category {index + 1} of {total}
        </span>
        <button onClick={onNext} className="btn-primary">
          {index < total - 1 ? "Next category" : "Done"}
        </button>
      </div>
    </div>
  );
}

function ReviewStep({
  categories,
  answers,
  scaleLabels,
  busy,
  onBack,
  onEdit,
  onSubmit,
}: {
  categories: SurveyCategoryNode[];
  answers: Record<string, number>;
  scaleLabels: string[];
  busy: boolean;
  onBack: () => void;
  onEdit: (i: number) => void;
  onSubmit: () => void;
}) {
  const total = categories.reduce((n, c) => n + c.questions.length, 0);
  const answered = categories.reduce(
    (n, c) => n + c.questions.filter((q) => answers[q.id] !== undefined).length,
    0
  );

  return (
    <div className="space-y-4">
      <div className="card overflow-hidden">
        <div className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Review your responses
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Check your answers before you submit. You can edit any category.
            </p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3.5 py-1.5 text-sm font-bold text-primary">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            {answered} of {total} answered
          </span>
        </div>
      </div>

      {categories.map((c, i) => (
        <div key={c.id} className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-300/70 p-5 sm:px-8">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <CategoryIcon icon={c.icon} width={20} height={20} />
              </span>
              <h3 className="font-bold text-gray-900">
                {i + 1}. {c.name}
              </h3>
            </div>
            <button
              onClick={() => onEdit(i)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:border-primary/40 hover:text-primary"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
              Edit
            </button>
          </div>
          <ul className="divide-y divide-gray-300/50">
            {c.questions.map((q) => {
              const v = answers[q.id];
              return (
                <li
                  key={q.id}
                  className="flex items-start justify-between gap-4 px-5 py-4 sm:px-8"
                >
                  <span className="text-sm text-gray-700">{q.question_text}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span
                      className={`grid h-6 w-6 place-items-center rounded-md text-xs font-bold ${
                        v === undefined
                          ? "bg-gray-100 text-gray-400"
                          : "bg-primary/10 text-primary"
                      }`}
                    >
                      {v ?? "-"}
                    </span>
                    <span className="w-32 text-right text-sm font-medium text-gray-900">
                      {v !== undefined ? scaleLabels[v] : "Not answered"}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <div className="card flex items-center justify-between p-5 sm:px-8">
        <button onClick={onBack} className="btn-secondary">
          Back
        </button>
        <button onClick={onSubmit} disabled={busy} className="btn-primary">
          {busy ? "Submitting..." : "Submit survey"}
        </button>
      </div>
    </div>
  );
}

function DoneStep({
  email,
  statusToken,
}: {
  email: string;
  statusToken: string | null;
}) {
  return (
    <div className="card p-8 text-center sm:p-12">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-success/10 text-success">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
      <h1 className="mt-6 text-2xl font-extrabold tracking-tight text-gray-900">
        Thank you!
      </h1>
      <p className="mt-2 text-gray-700">
        Your survey has been submitted successfully.
      </p>
      <div className="mx-auto mt-6 max-w-md rounded-lg bg-gray-100 p-5 text-left text-sm text-gray-700">
        A program representative will review your responses. Track your progress
        any time from your status page - we recorded it against{" "}
        <span className="font-semibold text-gray-900">{email}</span>.
      </div>
      {statusToken && (
        <Link to={`/survey/status/${statusToken}`} className="btn-primary mt-6">
          Check your status
        </Link>
      )}
    </div>
  );
}

function Field({
  label,
  required,
  optional,
  error,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="label">
        {label}{" "}
        {required && <span className="text-danger">*</span>}
        {optional && <span className="font-normal text-gray-400">(optional)</span>}
      </label>
      {children}
      {error ? (
        <p className="field-error">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-gray-500">{hint}</p>
      ) : null}
    </div>
  );
}
