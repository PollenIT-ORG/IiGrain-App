import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useListSubmissionsQuery } from "../store/endpoints/programsApi";
import { useListProgramsQuery } from "../store/endpoints/programsApi";
import Select from "../components/ui/Select";
import Loader from "../components/Loader";
import { ChevronLeftIcon, ChevronRightIcon } from "../components/icons";
import type { Submission } from "../types";
import { fmtDate } from "../lib/datetime";

function errMsg(err: unknown): string {
  return (
    (err as { message?: string })?.message ??
    "Something went wrong. Please try again."
  );
}

const PAGE_SIZE = 20;
const ROLE_OPTIONS = [
  { value: "", label: "Farmer & Assessor" },
  { value: "farmer", label: "Farmer only" },
  { value: "assessor", label: "Assessor only" },
];

const REVIEW_OPTIONS = [
  { value: "", label: "All submissions" },
  { value: "in_review", label: "Waiting for review" },
  { value: "approved", label: "Approved" },
];

function ReviewBadge({ status }: { status: Submission["reviewStatus"] }) {
  const approved = status === "approved";
  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${
        approved ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
      }`}
    >
      {approved ? "Approved" : "In review"}
    </span>
  );
}

function formatDate(iso: string | null): string {
  return fmtDate(iso);
}

function RoleBadge({ role }: { role: Submission["authorRole"] }) {
  const isAssessor = role === "assessor";
  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${
        isAssessor ? "bg-info/10 text-info" : "bg-primary/10 text-primary"
      }`}
    >
      {isAssessor ? "Assessor" : "Farmer"}
    </span>
  );
}

export default function Submissions() {
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [programId, setProgramId] = useState("");
  const [role, setRole] = useState("");
  const [reviewStatus, setReviewStatus] = useState("");

  const { data, isLoading, isError, error } = useListSubmissionsQuery({
    page,
    limit: PAGE_SIZE,
    programId: programId || undefined,
    authorRole: (role as "farmer" | "assessor") || undefined,
    reviewStatus: (reviewStatus as "in_review" | "approved") || undefined,
  });
  const submissions = data?.submissions ?? [];
  const meta = data?.meta ?? null;


  const { data: programsData } = useListProgramsQuery({ page: 1, limit: 100 });
  const PROGRAM_OPTIONS = [
    { value: "", label: "All programs" },
    ...(programsData?.programs ?? []).map((p) => ({ value: p.id, label: p.name })),
  ];

  useEffect(() => {
    setPage(1);
  }, [programId, role, reviewStatus]);

  const totalPages = meta?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Submitted Assessments</h1>
        <p className="mt-1 text-sm text-gray-500">
          {meta
            ? `${meta.total.toLocaleString()} submission(s)`
            : "Farmer and assessor submitted assessments"}
        </p>
      </div>

      <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <Select
          value={programId}
          onChange={setProgramId}
          options={PROGRAM_OPTIONS}
          className="sm:w-64"
        />
        <Select
          value={role}
          onChange={setRole}
          options={ROLE_OPTIONS}
          className="sm:w-52"
        />
        <Select
          value={reviewStatus}
          onChange={setReviewStatus}
          options={REVIEW_OPTIONS}
          className="sm:w-52"
        />
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <Loader message="Loading submissions..." />
        ) : isError ? (
          <div className="px-5 py-16 text-center text-sm text-gray-500">
            {errMsg(error)}
          </div>
        ) : submissions.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-gray-500">
            No submitted assessments found.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-300 text-xs uppercase tracking-wider text-gray-500">
                    <th className="px-5 py-3 font-semibold">Field</th>
                    <th className="px-5 py-3 font-semibold">Farmer</th>
                    <th className="px-5 py-3 font-semibold">By</th>
                    <th className="px-5 py-3 font-semibold">Program</th>
                    <th className="px-5 py-3 font-semibold">Score</th>
                    <th className="px-5 py-3 font-semibold">Review</th>
                    <th className="px-5 py-3 font-semibold">Submitted</th>
                    <th className="px-5 py-3 text-right font-semibold">View</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((s) => (
                    <tr
                      key={s.assessmentId}
                      className="border-b border-gray-300/70 last:border-0 hover:bg-gray-100/60"
                    >
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() => navigate(`/fields/${s.fieldId}`)}
                          className="text-left font-medium text-gray-900 hover:text-primary hover:underline"
                        >
                          {s.fieldName}
                        </button>
                        {s.farmName && (
                          <div className="text-xs text-gray-500">{s.farmName}</div>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-gray-700">
                        {s.farmerName || "-"}
                      </td>
                      <td className="px-5 py-3.5">
                        <RoleBadge role={s.authorRole} />
                        {s.authorName && (
                          <div className="mt-0.5 text-xs text-gray-500">
                            {s.authorName}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-gray-700">
                        {s.programName || (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-gray-700">
                        {s.reviewStatus === "approved" ? (
                          <>
                            <span className="font-semibold text-gray-900">{s.percentage}%</span>{" "}
                            <span className="text-xs text-gray-500">
                              ({s.answered}/{s.totalQuestions})
                            </span>
                          </>
                        ) : (
                          <span className="text-xs text-gray-500">
                            {s.answered}/{s.totalQuestions} answered
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <ReviewBadge status={s.reviewStatus} />
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-gray-700">
                        {formatDate(s.submittedAt)}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => navigate(`/submissions/${s.assessmentId}`)}
                          className="text-sm font-medium text-primary hover:underline"
                        >
                          {s.reviewStatus === "approved" ? "Open" : "Review"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col items-center justify-between gap-3 border-t border-gray-300 px-5 py-3 sm:flex-row">
              <p className="text-sm text-gray-500">
                Page <span className="font-semibold text-gray-700">{page}</span> of{" "}
                <span className="font-semibold text-gray-700">{totalPages}</span>
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronLeftIcon width={16} height={16} />
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                  <ChevronRightIcon width={16} height={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
