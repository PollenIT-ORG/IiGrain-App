import type { ReactNode } from "react";

// The six tiles that summarise program submissions. They live here so the
// submissions page and the dashboard show one and the same set of numbers.

export interface SubmissionCard {
  status: string;
  label: string;
  sub: string;
  keys: string[];
  wrap: string;
  icon: ReactNode;
}

export const SUBMISSION_CARDS: SubmissionCard[] = [
  {
    status: "",
    label: "Total Submissions",
    sub: "All time",
    keys: [
      "draft",
      "submitted",
      "qualified",
      "contract_sent",
      "contract_signed",
      "enrolled",
      "not_qualified",
      "withdrawn",
    ],
    wrap: "bg-primary/10 text-primary",
    icon: <IconInbox />,
  },
  {
    status: "under_review",
    label: "Under Review",
    sub: "Awaiting review",
    keys: ["submitted", "qualified"],
    wrap: "bg-amber-100 text-amber-600",
    icon: <IconClock />,
  },
  {
    status: "contract_sent",
    label: "Contract Sent",
    sub: "Awaiting signature",
    keys: ["contract_sent", "contract_signed"],
    wrap: "bg-blue-100 text-blue-600",
    icon: <IconMail />,
  },
  {
    status: "enrolled",
    label: "Enrolled",
    sub: "Active producers",
    keys: ["enrolled"],
    wrap: "bg-success/10 text-success",
    icon: <IconCheck />,
  },
  {
    status: "not_qualified",
    label: "Not Qualified",
    sub: "Does not meet criteria",
    keys: ["not_qualified"],
    wrap: "bg-rose-100 text-rose-600",
    icon: <IconX />,
  },
  {
    status: "withdrawn",
    label: "Withdrawn",
    sub: "Voluntarily withdrawn",
    keys: ["withdrawn"],
    wrap: "bg-gray-200 text-gray-500",
    icon: <IconMinus />,
  },
];

interface Props {
  /** Counts by status, as the submissions stats endpoint returns them. */
  stats: Record<string, number> | undefined;
  /** The tile that is currently filtering the list, when there is one. */
  active?: string;
  onPick: (status: string) => void;
}

export function countFor(
  stats: Record<string, number> | undefined,
  keys: string[]
): number {
  return keys.reduce((n, k) => n + (stats?.[k] ?? 0), 0);
}

export default function ProgramSubmissionCards({ stats, active, onPick }: Props) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
      {SUBMISSION_CARDS.map((c) => (
        <button
          key={c.label}
          onClick={() => onPick(c.status)}
          className={`card p-5 text-left transition-shadow hover:shadow-card-hover ${
            active === c.status ? "ring-2 ring-primary/30" : ""
          }`}
        >
          <span className={`grid h-11 w-11 place-items-center rounded-xl ${c.wrap}`}>
            {c.icon}
          </span>
          <p className="mt-3 text-2xl font-extrabold text-gray-900">
            {countFor(stats, c.keys)}
          </p>
          <p className="mt-0.5 text-sm font-semibold text-gray-700">{c.label}</p>
          <p className="text-xs text-gray-500">{c.sub}</p>
        </button>
      ))}
    </div>
  );
}

// --- icons ---------------------------------------------------------------
function IconInbox() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" /></svg>
  );
}
function IconClock() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
  );
}
function IconMail() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 6L2 7" /></svg>
  );
}
function IconCheck() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="m9 11 3 3L22 4" /></svg>
  );
}
function IconX() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="m15 9-6 6M9 9l6 6" /></svg>
  );
}
function IconMinus() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M8 12h8" /></svg>
  );
}
