import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams, useParams } from "react-router-dom";
import { showError, showSuccess } from "../../lib/toast";
import Select from "../../components/ui/Select";
import PhoneInput from "../../components/ui/PhoneInput";
import { isValidPhoneNumber } from "react-phone-number-input/max";
import Loader from "../../components/Loader";
import Portal from "../../components/ui/Portal";
import SurveyLayout, { type SurveyStep } from "../survey/SurveyLayout";
import { CategoryIconChip } from "../survey/SurveyIcons";
import { STATES, REFERRAL_SOURCES } from "../survey/states";
import {
  programSurveyApi,
  SurveyApiError,
  type SurveyStructure,
  type SurveyCategoryNode,
} from "../../lib/programSurveyApi";

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
  phone: string;
  farmName: string;
  referralSource: string;
  state: string;
  totalAcres: string;
}

const EMPTY: Details = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  farmName: "",
  referralSource: "",
  state: "",
  totalAcres: "",
};

export default function SurveyAssessment() {
  const [params] = useSearchParams();
  const { token = "" } = useParams();
  // Bind the program's link token so every survey-scoped call carries it, while
  // the rest of this component keeps calling `surveyApi.*` unchanged.
  const surveyApi = useMemo(
    () => ({
      structure: () => programSurveyApi.structure(token),
      checkEmail: (email: string) => programSurveyApi.checkEmail(token, email),
      sendOtp: programSurveyApi.sendOtp,
      verifyOtp: programSurveyApi.verifyOtp,
      saveDraft: (
        d: Parameters<typeof programSurveyApi.saveDraft>[1],
        a: Record<string, number>
      ) => programSurveyApi.saveDraft(token, d, a),
      submit: (
        d: Parameters<typeof programSurveyApi.submit>[1],
        a: Record<string, number>
      ) => programSurveyApi.submit(token, d, a),
      lookupStatus: async (email: string) => {
        const res = await programSurveyApi.checkEmail(token, email);
        return { statusToken: res.statusToken ?? "" };
      },
    }),
    [token]
  );
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
  const [detailsLocked, setDetailsLocked] = useState(false);

  // Email verification (OTP) before a new producer can save.
  const [emailVerified, setEmailVerified] = useState(false);
  const [otpOpen, setOtpOpen] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);

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
    // Changing the email means it must be verified again.
    if (k === "email") setEmailVerified(false);
  }

  // Send a verification code to the entered email and open the OTP popup.
  async function sendOtp(email: string) {
    setOtpSending(true);
    try {
      const { code } = await surveyApi.sendOtp(email);
      setDevCode(code ?? null);
      setOtpOpen(true);
    } catch (err) {
      showError(
        err instanceof SurveyApiError
          ? err.message
          : "Could not send the code. Please try again."
      );
    } finally {
      setOtpSending(false);
    }
  }

  // Verify looks the email up first. Somebody already on file carries on where
  // they left off, and only an email new to this survey is sent a code.
  async function startVerify() {
    const email = details.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      setErrors((e) => ({ ...e, email: "Enter a valid email address." }));
      return;
    }
    const state = await resumeFromEmail(email, true);
    if (state === null) {
      showError("Could not check that email. Please try again.");
      return;
    }
    // Resumed, or already completed: there is nothing to send a code for.
    if (state !== "new") return;
    await sendOtp(email);
  }

  // Confirm the code the producer typed in the popup.
  async function confirmOtp(codeInput: string) {
    const email = details.email.trim().toLowerCase();
    setOtpVerifying(true);
    try {
      await surveyApi.verifyOtp(email, codeInput.trim());
      setEmailVerified(true);
      setOtpOpen(false);
      setDevCode(null);
      showSuccess("Email verified.");
    } catch (err) {
      showError(
        err instanceof SurveyApiError
          ? err.message
          : "That code is invalid or has expired."
      );
    } finally {
      setOtpVerifying(false);
    }
  }

  function toDetailsPayload() {
    return {
      firstName: details.firstName.trim(),
      lastName: details.lastName.trim(),
      email: details.email.trim().toLowerCase(),
      phone: details.phone.trim() || null,
      farmName: details.farmName.trim() || null,
      referralSource: details.referralSource || null,
      state: details.state || null,
      totalAcres: details.totalAcres ? Number(details.totalAcres) : null,
    };
  }

  // Look up an email: resume a draft or a producer already on file (straight
  // into the survey), or flag a completed submission. Returns what was found,
  // or null when the lookup itself could not be made.
  async function resumeFromEmail(
    email: string,
    jump: boolean
  ): Promise<"new" | "draft" | "returning" | "submitted" | null> {
    setCheckingEmail(true);
    try {
      const res = await surveyApi.checkEmail(email.trim().toLowerCase());
      if (res.state === "submitted") {
        setSubmittedToken(res.statusToken);
        return "submitted";
      }
      // Already holds an Enrollment ID, so the details are on file and the
      // survey opens straight at the questions.
      if (res.state === "returning" && res.profile) {
        const p = res.profile;
        setDetails((prev) => ({
          ...prev,
          firstName: p.firstName ?? "",
          lastName: p.lastName ?? "",
          phone: p.phone ?? prev.phone,
          farmName: p.farmName ?? "",
          referralSource: p.referralSource ?? "",
          state: p.state ?? "",
          totalAcres: p.totalAcres ?? "",
        }));
        setDetailsLocked(true);
        setSubmittedToken(null);
        if (jump) {
          setStep("categories");
          showSuccess("Welcome back. Using the details from your earlier survey.");
        }
        return "returning";
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
        return "draft";
      }
      setSubmittedToken(null);
      return "new";
    } catch {
      return null;
    } finally {
      setCheckingEmail(false);
    }
  }

  function validateDetails(): boolean {
    const e: Record<string, string> = {};
    if (!details.firstName.trim()) e.firstName = "First name is required.";
    else if (details.firstName.trim().length > 150)
      e.firstName = "First name is too long.";
    if (!details.lastName.trim()) e.lastName = "Last name is required.";
    else if (details.lastName.trim().length > 150)
      e.lastName = "Last name is too long.";
    if (!details.email.trim()) e.email = "Email address is required.";
    else if (!EMAIL_RE.test(details.email.trim()))
      e.email = "Enter a valid email address.";
    if (!details.state) e.state = "Please choose your state.";
    // Phone is optional, but if given it must be a real number - not a wall of
    // digits. isValidPhoneNumber checks the format for the chosen country.
    if (details.phone && !isValidPhoneNumber(details.phone))
      e.phone = "Enter a valid phone number.";
    const acres = Number(details.totalAcres);
    if (!details.totalAcres.trim()) e.totalAcres = "Total acres is required.";
    else if (Number.isNaN(acres) || acres <= 0)
      e.totalAcres = "Enter a number greater than zero.";
    else if (acres > 1000000) e.totalAcres = "Enter a realistic acreage.";
    if (details.farmName.trim().length > 200)
      e.farmName = "Farm or business name is too long.";
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
    if (!emailVerified) {
      showError("Please verify your email to continue.");
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
          programName={structure.programName}
          surveyName={structure.surveyName}
          details={details}
          errors={errors}
          set={set}
          onPhoneBlur={(rawInput) =>
            setErrors((e) => {
              const next = { ...e };
              // The user typed digits but they don't form a valid number - this
              // catches both a parsed-but-invalid value and junk the library
              // couldn't parse at all (which arrives as an empty phone).
              const typedDigits = rawInput.replace(/\D/g, "");
              if (
                typedDigits &&
                (!details.phone || !isValidPhoneNumber(details.phone))
              )
                next.phone = "Enter a valid phone number.";
              else delete next.phone;
              return next;
            })
          }
          submittedToken={submittedToken}
          busy={busy}
          checkingEmail={checkingEmail}
          emailVerified={emailVerified}
          otpSending={otpSending}
          onVerify={startVerify}
          onSubmit={saveAndContinue}
        />
      )}

      {otpOpen && (
        <OtpModal
          email={details.email.trim().toLowerCase()}
          devCode={devCode}
          verifying={otpVerifying}
          onResend={() => void sendOtp(details.email.trim().toLowerCase())}
          onVerify={confirmOtp}
          onClose={() => setOtpOpen(false)}
        />
      )}

      {step === "categories" && (
        <CategoriesStep
          categories={categories}
          answers={answers}
          onOpen={openCategory}
          onReview={() => setStep("review")}
          onEditDetails={() => setStep("details")}
          detailsLocked={detailsLocked}
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
        <div className="flex min-h-full items-center justify-center">
          <DoneStep email={details.email.trim().toLowerCase()} />
        </div>
      )}
    </SurveyLayout>
  );
}

// ---------------------------------------------------------------------------

function DetailsStep({
  programName,
  surveyName,
  details,
  errors,
  set,
  onPhoneBlur,
  submittedToken,
  busy,
  checkingEmail,
  emailVerified,
  otpSending,
  onVerify,
  onSubmit,
}: {
  programName: string;
  surveyName: string;
  details: Details;
  errors: Record<string, string>;
  set: <K extends keyof Details>(k: K, v: Details[K]) => void;
  onPhoneBlur: (rawInput: string) => void;
  submittedToken: string | null;
  busy: boolean;
  checkingEmail: boolean;
  emailVerified: boolean;
  otpSending: boolean;
  onVerify: () => void;
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
            {programName}
          </h1>
          {/* The program runs the survey; the survey is what is being answered. */}
          {surveyName && (
            <p className="mt-2 text-sm font-semibold text-primary">{surveyName}</p>
          )}
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
            This email has already completed the survey. Our team will review it
            and update you by email.
          </div>
        )}

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Field label="First name" required error={errors.firstName}>
            <input
              className={`input-field ${errors.firstName ? "input-error" : ""}`}
              value={details.firstName}
              onChange={(e) => set("firstName", e.target.value)}
              placeholder="Enter first name"
              maxLength={150}
            />
          </Field>
          <Field label="Last name" required error={errors.lastName}>
            <input
              className={`input-field ${errors.lastName ? "input-error" : ""}`}
              value={details.lastName}
              onChange={(e) => set("lastName", e.target.value)}
              placeholder="Enter last name"
              maxLength={150}
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
            <div className="flex items-stretch gap-2">
              {/* Nothing is looked up while they type. The check runs when they
                  press Verify, which is where the spinner belongs. */}
              <input
                type="email"
                className={`input-field w-full flex-1 ${errors.email ? "input-error" : ""}`}
                value={details.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="Enter email address"
                maxLength={255}
              />
              {emailVerified ? (
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-success/30 bg-success/5 px-3 text-sm font-semibold text-success">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  Verified
                </span>
              ) : (
                <button
                  type="button"
                  onClick={onVerify}
                  disabled={
                    checkingEmail ||
                    otpSending ||
                    !EMAIL_RE.test(details.email.trim())
                  }
                  className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-primary/40 px-4 text-sm font-semibold text-primary transition-colors hover:bg-primary/5 disabled:opacity-50"
                >
                  {checkingEmail || otpSending ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
                      </svg>
                      {checkingEmail ? "Checking..." : "Sending..."}
                    </>
                  ) : (
                    "Verify"
                  )}
                </button>
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
          <Field label="Phone number" optional error={errors.phone}>
            <PhoneInput
              value={details.phone}
              onChange={(v) => set("phone", v)}
              onBlur={onPhoneBlur}
              placeholder="Enter phone number"
            />
          </Field>
          <Field label="Approximate total acres" required error={errors.totalAcres}>
            <input
              type="number"
              min="0"
              max="1000000"
              className={`input-field ${errors.totalAcres ? "input-error" : ""}`}
              value={details.totalAcres}
              onChange={(e) => set("totalAcres", e.target.value)}
              placeholder="Enter total acres"
            />
          </Field>
          <Field label="Farm or business name" optional error={errors.farmName}>
            <input
              className={`input-field ${errors.farmName ? "input-error" : ""}`}
              maxLength={200}
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

        <div className="mt-7 flex items-center justify-end">
          <button
            type="submit"
            disabled={
              busy || checkingEmail || !emailVerified || Boolean(submittedToken)
            }
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

// The OTP popup. When email delivery is off the code is auto-filled (dev);
// when it is on the producer types the code they received by email.
function OtpModal({
  email,
  devCode,
  verifying,
  onResend,
  onVerify,
  onClose,
}: {
  email: string;
  devCode: string | null;
  verifying: boolean;
  onResend: () => void;
  onVerify: (code: string) => void;
  onClose: () => void;
}) {
  const [code, setCode] = useState(devCode ?? "");
  // Cooldown before the code can be resent (2 minutes).
  const [secondsLeft, setSecondsLeft] = useState(120);

  // Auto-fill when a dev code arrives (SMTP disabled).
  useEffect(() => {
    if (devCode) setCode(devCode);
  }, [devCode]);

  // Tick the resend cooldown down to zero.
  useEffect(() => {
    const t = setInterval(
      () => setSecondsLeft((s) => (s > 0 ? s - 1 : 0)),
      1000
    );
    return () => clearInterval(t);
  }, []);

  function handleResend() {
    if (secondsLeft > 0) return;
    setSecondsLeft(120);
    onResend();
  }

  const mmss = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`;

  return (
    <Portal>
      <div className="modal-overlay" onMouseDown={onClose}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onVerify(code);
          }}
          className="modal-panel card w-full max-w-sm p-6 sm:p-7"
          onMouseDown={(e) => e.stopPropagation()}
          noValidate
        >
          <h2 className="text-lg font-bold text-gray-900">Verify your email</h2>
          <p className="mt-1 text-sm text-gray-600">
            We sent a code to{" "}
            <span className="font-semibold text-gray-900">{email}</span>. Enter
            it below to continue.
          </p>

          {devCode && (
            <p className="mt-3 rounded-lg bg-info/5 px-3 py-2 text-xs text-gray-600">
              Email delivery is off, so your code is{" "}
              <span className="font-bold text-gray-900">{devCode}</span>{" "}
              (auto-filled).
            </p>
          )}

          <input
            autoFocus
            inputMode="numeric"
            className="input-field mt-4 text-center text-xl font-bold tracking-[0.4em]"
            value={code}
            onChange={(e) =>
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            placeholder="------"
            maxLength={6}
          />

          <button
            type="submit"
            disabled={verifying || code.trim().length < 4}
            className="btn-primary mt-5 w-full disabled:opacity-60"
          >
            {verifying ? (
              <span className="inline-flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
                </svg>
                Verifying...
              </span>
            ) : (
              "Verify"
            )}
          </button>

          <div className="mt-3 flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={handleResend}
              disabled={secondsLeft > 0}
              className="font-medium text-gray-500 hover:text-primary disabled:cursor-not-allowed disabled:text-gray-400 disabled:no-underline disabled:hover:text-gray-400"
            >
              {secondsLeft > 0 ? `Resend code in ${mmss}` : "Resend code"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="font-medium text-gray-500 hover:text-primary"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </Portal>
  );
}

function CategoriesStep({
  categories,
  answers,
  onOpen,
  onReview,
  onEditDetails,
  detailsLocked,
}: {
  categories: SurveyCategoryNode[];
  answers: Record<string, number>;
  onOpen: (i: number) => void;
  onReview: () => void;
  onEditDetails: () => void;
  detailsLocked: boolean;
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
        {detailsLocked ? (
          <p className="shrink-0 text-sm text-gray-500">
            Using your details from an earlier survey.
          </p>
        ) : (
          <button
            onClick={onEditDetails}
            className="shrink-0 text-sm font-medium text-gray-500 hover:text-primary"
          >
            Edit details
          </button>
        )}
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
                <CategoryIconChip icon={c.icon} size={22} className="h-11 w-11 rounded-xl" />
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
            <CategoryIconChip icon={category.icon} size={24} className="h-12 w-12 shrink-0 rounded-2xl" />
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
              {(q.options ?? scaleLabels).map((label, value) => {
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
              <CategoryIconChip icon={c.icon} size={20} className="h-10 w-10 rounded-xl" />
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
                      {v !== undefined ? (q.options ?? scaleLabels)[v] : "Not answered"}
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

function DoneStep({ email }: { email: string }) {
  return (
    <div className="card mx-auto w-full max-w-xl p-8 text-center sm:p-12">
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
      <div className="mx-auto mt-6 max-w-md rounded-lg bg-gray-100 p-5 text-center text-sm text-gray-700">
        Our team will review your survey and update you by email. We recorded it
        against <span className="font-semibold text-gray-900">{email}</span>.
      </div>
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
