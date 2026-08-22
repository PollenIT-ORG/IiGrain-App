import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import SurveyLayout, { type SurveyStep } from "../survey/SurveyLayout";
import Loader from "../../components/Loader";
import { connectSurveySocket } from "../../lib/surveySocket";
import {
  programSurveyApi as surveyApi,
  SurveyApiError,
  type StatusResponse,
  type SubmissionStatus,
} from "../../lib/programSurveyApi";

const BAND_LABEL: Record<string, string> = {
  gold: "Gold",
  silver: "Silver",
  bronze: "Bronze",
  not_qualified: "Not Qualified",
};

// Each qualifying tier gets its own medal colour so the result reads at a glance.
const BAND_STYLE: Record<
  string,
  { card: string; value: string; iconWrap: string; caption: string }
> = {
  gold: {
    card: "border-amber-200 bg-amber-50",
    value: "text-amber-700",
    iconWrap: "bg-amber-100 text-amber-600",
    caption: "Top tier result",
  },
  silver: {
    card: "border-slate-200 bg-slate-50",
    value: "text-slate-600",
    iconWrap: "bg-slate-200 text-slate-500",
    caption: "Strong result",
  },
  bronze: {
    card: "border-orange-200 bg-orange-50",
    value: "text-orange-700",
    iconWrap: "bg-orange-100 text-orange-600",
    caption: "Qualifying result",
  },
  not_qualified: {
    card: "border-gray-300 bg-gray-100",
    value: "text-gray-700",
    iconWrap: "bg-gray-200 text-gray-500",
    caption: "Did not qualify",
  },
};

const PILL: Record<string, { label: string; className: string }> = {
  submitted: { label: "In review", className: "bg-info/10 text-info" },
  not_qualified: { label: "Not qualified", className: "bg-danger/10 text-danger" },
  qualified: { label: "Qualified", className: "bg-secondary/15 text-secondary" },
  contract_sent: { label: "Contract sent", className: "bg-accent/15 text-accent" },
  contract_signed: { label: "Awaiting acceptance", className: "bg-info/10 text-info" },
  enrolled: { label: "Enrolled", className: "bg-success/10 text-success" },
};

// Stage card colour follows the same semantic palette as the status pill.
const STAGE_STYLE: Record<string, { card: string; value: string; iconWrap: string }> = {
  submitted: { card: "border-info/20 bg-info/5", value: "text-info", iconWrap: "bg-info/10 text-info" },
  qualified: { card: "border-secondary/20 bg-secondary/5", value: "text-secondary", iconWrap: "bg-secondary/10 text-secondary" },
  contract_sent: { card: "border-accent/20 bg-accent/5", value: "text-accent", iconWrap: "bg-accent/10 text-accent" },
  contract_signed: { card: "border-info/20 bg-info/5", value: "text-info", iconWrap: "bg-info/10 text-info" },
  enrolled: { card: "border-success/20 bg-success/5", value: "text-success", iconWrap: "bg-success/10 text-success" },
  not_qualified: { card: "border-danger/20 bg-danger/5", value: "text-danger", iconWrap: "bg-danger/10 text-danger" },
};

function MedalIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15" />
      <path d="M11 12 5.12 2.2M13 12l5.88-9.8M8 7h8" />
      <circle cx="12" cy="17" r="5" />
      <path d="M12 18v-2h-.5" />
    </svg>
  );
}
function MapIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0Z" />
      <path d="M15 5.764v15M9 3.236v15" />
    </svg>
  );
}
function FlagIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1Z" />
      <line x1="4" x2="4" y1="22" y2="15" />
    </svg>
  );
}

const STEPS_TL: Array<{ key: SubmissionStatus; label: string; note: string }> = [
  { key: "qualified", label: "Survey submitted", note: "We received your answers" },
  { key: "contract_sent", label: "Contract sent", note: "Sign it from your email or below" },
  { key: "contract_signed", label: "Contract signed", note: "Waiting for our team to accept" },
  { key: "enrolled", label: "Enrolled", note: "Enrollment ID emailed to you" },
];
const ORDER: SubmissionStatus[] = [
  "draft", "submitted", "qualified", "contract_sent", "contract_signed", "enrolled",
];
const reached = (cur: SubmissionStatus, step: SubmissionStatus) =>
  ORDER.indexOf(cur) >= ORDER.indexOf(step);

const RAIL: SurveyStep[] = [
  { key: "status", title: "Your status", note: "Track your application" },
];

export default function SurveyStatus() {
  const { token = "" } = useParams();
  const [data, setData] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [live, setLive] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await surveyApi.status(token));
    } catch (err) {
      setError(
        err instanceof SurveyApiError ? err.message : "Could not load your status."
      );
    } finally {
      setReady(true);
    }
  }, [token]);

  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    void load();
  }, [load]);

  // Live updates: join the submission room with the status token and refresh
  // whenever the application moves (contract sent, signed, enrolled).
  useEffect(() => {
    if (!token) return;
    const socket = connectSurveySocket(token);
    socket.on("connect", () => setLive(true));
    socket.on("disconnect", () => setLive(false));
    socket.on("application:changed", () => void loadRef.current());
    return () => {
      socket.off("application:changed");
      socket.close();
    };
  }, [token]);

  if (!ready) {
    return (
      <SurveyLayout steps={RAIL} activeStep="status" completedCount={0} totalCount={0}>
        <Loader message="Loading your status..." />
      </SurveyLayout>
    );
  }
  if (error || !data) {
    return (
      <SurveyLayout steps={RAIL} activeStep="status" completedCount={0} totalCount={0}>
        <div className="card p-10 text-center">
          <h1 className="text-xl font-bold text-gray-900">
            This status link is not valid
          </h1>
          <p className="mt-3 text-gray-700">
            {error ?? "Please use the link from your email."}
          </p>
        </div>
      </SurveyLayout>
    );
  }

  const pill = PILL[data.status] ?? PILL.submitted;
  const notQualified = data.status === "not_qualified";
  const band = BAND_STYLE[data.category] ?? BAND_STYLE.not_qualified;
  const stage = STAGE_STYLE[data.status] ?? STAGE_STYLE.submitted;

  return (
    <SurveyLayout steps={RAIL} activeStep="status" completedCount={0} totalCount={0}>
      <div className="card flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            {data.programName}
          </p>
          <h1 className="text-xl font-extrabold tracking-tight text-gray-900">
            {data.fullName}
          </h1>
          <p className="text-sm text-gray-500">{data.email}</p>
        </div>
        <span
          className={`inline-flex w-fit items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-bold ${pill.className}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {pill.label}
        </span>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <ResultCard
          label="Band"
          value={BAND_LABEL[data.category] ?? data.category}
          hint={band.caption}
          cardClass={band.card}
          valueClass={band.value}
          iconWrap={band.iconWrap}
          icon={<MedalIcon />}
        />
        <ResultCard
          label="Land"
          value={data.totalAcres ? `${data.totalAcres} acres` : "-"}
          hint={data.state ?? undefined}
          cardClass="border-primary/20 bg-primary/5"
          valueClass="text-primary"
          iconWrap="bg-primary/10 text-primary"
          icon={<MapIcon />}
        />
        <ResultCard
          label="Stage"
          value={pill.label}
          cardClass={stage.card}
          valueClass={stage.value}
          iconWrap={stage.iconWrap}
          icon={<FlagIcon />}
        />
      </div>

      {data.status === "contract_sent" && data.contractToken && (
        <div className="card mt-4 flex flex-col items-start justify-between gap-4 border-accent/30 bg-accent/5 p-6 sm:flex-row sm:items-center">
          <div>
            <p className="font-semibold text-gray-900">
              Your contract is ready to sign
            </p>
            <p className="mt-1 text-sm text-gray-700">
              Read it and sign online. Nothing needs to be printed.
            </p>
          </div>
          <Link
            to={`/program-admin-survey/contract/${data.contractToken}?s=${token}`}
            className="btn-primary"
          >
            Read and sign contract
          </Link>
        </div>
      )}

      {data.status === "contract_signed" && (
        <div className="card mt-4 border-info/30 bg-info/5 p-6">
          <p className="font-semibold text-gray-900">Thanks, that is signed</p>
          <p className="mt-1 text-sm text-gray-700">
            Our team is reviewing your signed contract. You will get your
            Enrollment ID by email once it is accepted.
          </p>
        </div>
      )}

      {data.status === "enrolled" && (
        <div className="card mt-4 border-success/30 bg-success/5 p-6">
          <p className="font-semibold text-gray-900">You are enrolled</p>
          <p className="mt-1 text-sm text-gray-700">
            We have emailed you your Enrollment ID. Install the mobile app and
            enter that ID the first time you register - it is required, so keep
            the email safe.
          </p>
          {data.appLink && (
            <a href={data.appLink} className="btn-primary mt-4" target="_blank" rel="noreferrer">
              Get the app
            </a>
          )}
        </div>
      )}

      {notQualified && (
        <div className="card mt-4 border-danger/20 bg-danger/5 p-6">
          <p className="font-semibold text-gray-900">Survey result</p>
          <p className="mt-1 text-sm text-gray-700">{data.message}</p>
        </div>
      )}

      {!notQualified && (
        <div className="card mt-4 p-6 sm:p-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
            Your progress
          </h2>
          <ol className="mt-5 space-y-5">
            {STEPS_TL.map((step) => {
              const done = reached(data.status, step.key);
              const current = data.status === step.key;
              return (
                <li key={step.key} className="flex items-start gap-4">
                  <span
                    className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
                      done ? "bg-primary text-white" : "border border-gray-300 bg-white text-gray-400"
                    }`}
                  >
                    {done ? (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    ) : ""}
                  </span>
                  <div>
                    <p className={`font-medium ${current ? "text-primary" : "text-gray-900"}`}>
                      {step.label}
                    </p>
                    <p className="text-sm text-gray-500">{step.note}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <div className="mt-4 flex items-center justify-center gap-4">
        {live && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            Live - updates automatically
          </span>
        )}
        <button
          onClick={() => void load()}
          className="text-sm font-medium text-gray-500 hover:text-primary"
        >
          Refresh status
        </button>
      </div>
    </SurveyLayout>
  );
}

function ResultCard({
  label,
  value,
  hint,
  cardClass,
  valueClass,
  iconWrap,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  cardClass: string;
  valueClass: string;
  iconWrap: string;
  icon: ReactNode;
}) {
  return (
    <div className={`rounded-2xl border p-5 shadow-card ${cardClass}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          {label}
        </p>
        <span className={`grid h-9 w-9 place-items-center rounded-xl ${iconWrap}`}>
          {icon}
        </span>
      </div>
      <p className={`mt-3 text-2xl font-extrabold ${valueClass}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}
