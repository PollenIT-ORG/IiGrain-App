import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  useListSubmissionsQuery,
  useSubmissionStatsQuery,
  useDeleteSubmissionMutation,
  CATEGORY_LABEL,
  CATEGORY_STYLE,
  STATUS_LABEL,
  STATUS_STYLE,
  CHANNEL_LABEL,
  CHANNEL_STYLE,
  type Category,
  type SubmissionStatus,
  type Submission,
} from "../store/endpoints/eligibilityApi";
import { errMsg } from "../lib/errMsg";
import { useLiveData } from "../lib/useLiveData";
import { showSuccess, showError } from "../lib/toast";
import { useDialog } from "../components/ui/DialogProvider";
import Select from "../components/ui/Select";
import Loader from "../components/Loader";
import ShareSurveyModal from "../components/ShareSurveyModal";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  TrashIcon,
  ShareIcon,
} from "../components/icons";

const PAGE_SIZE = 10;

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "qualified", label: "Prospective Producer" },
  { value: "contract_sent", label: "Contract sent" },
  { value: "contract_signed", label: "Awaiting acceptance" },
  { value: "enrolled", label: "Enrolled" },
  { value: "not_qualified", label: "Not qualified" },
];

const CATEGORY_OPTIONS = [
  { value: "", label: "All bands" },
  { value: "gold", label: "Gold" },
  { value: "silver", label: "Silver" },
  { value: "bronze", label: "Bronze" },
  { value: "not_qualified", label: "Not Qualified" },
];

const CHANNEL_OPTIONS = [
  { value: "", label: "All sources" },
  { value: "website", label: "Website" },
  { value: "standalone", label: "Survey link" },
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString();
}

export default function EligibilitySubmissions() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { confirm } = useDialog();
  const [deleteSubmission] = useDeleteSubmissionMutation();

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  // The dashboard links in with ?status=..., so the URL owns this filter.
  const status = params.get("status") ?? "";
  const [category, setCategory] = useState("");
  const [channel, setChannel] = useState("");

  function setStatus(next: string) {
    const p = new URLSearchParams(params);
    if (next) p.set("status", next);
    else p.delete("status");
    setParams(p, { replace: true });
  }

  // Debounce the search box so typing does not fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => setPage(1), [status, category, channel, search]);

  const { data, isLoading, isFetching, isError, error, refetch } =
    useListSubmissionsQuery({
      page,
      limit: PAGE_SIZE,
      status: (status || undefined) as SubmissionStatus | undefined,
      category: (category || undefined) as Category | undefined,
      channel: (channel || undefined) as "website" | "standalone" | undefined,
      search: search || undefined,
    });
  const { data: stats, refetch: refetchStats } = useSubmissionStatsQuery();

  useLiveData(["eligibility"], () => {
    void refetch();
    void refetchStats();
  });

  const submissions = data?.submissions ?? [];
  const meta = data?.meta ?? null;
  const totalPages = meta?.totalPages ?? 1;
  const loading = isLoading || isFetching;

  async function handleDelete(s: Submission) {
    const enrolled = s.status === "enrolled";
    const ok = await confirm({
      title: "Delete this submission?",
      message: enrolled
        ? `${s.full_name} is already enrolled (${s.enrollment_id}). Deleting removes their survey submission from this list. This cannot be undone.`
        : `${s.full_name}'s survey submission will be removed. This cannot be undone.`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await deleteSubmission(s.id).unwrap();
      showSuccess("Submission deleted.");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  const cards = [
    { label: "Prospective Producers", value: stats?.qualified ?? 0 },
    { label: "Contract sent", value: stats?.contract_sent ?? 0 },
    { label: "Awaiting acceptance", value: stats?.contract_signed ?? 0 },
    { label: "Enrolled", value: stats?.enrolled ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Survey Submissions</h1>
          <p className="mt-1 text-sm text-gray-500">
            Everyone who completed the eligibility survey. Review their band,
            send the contract, and issue the Enrollment ID.
          </p>
        </div>
        <button
          onClick={() => setShareOpen(true)}
          className="btn-primary shrink-0 self-start"
        >
          <ShareIcon width={18} height={18} />
          Share survey
        </button>
      </div>

      {shareOpen && <ShareSurveyModal onClose={() => setShareOpen(false)} />}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="card p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              {c.label}
            </p>
            <p className="mt-2 text-2xl font-extrabold text-gray-900">
              {c.value}
            </p>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-gray-300 p-5 sm:flex-row sm:items-center">
          <input
            className="input-field sm:max-w-xs"
            placeholder="Search by name or email"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:justify-end">
            <Select
              value={status}
              onChange={setStatus}
              options={STATUS_OPTIONS}
              placeholder="All statuses"
            />
            <Select
              value={category}
              onChange={setCategory}
              options={CATEGORY_OPTIONS}
              placeholder="All bands"
            />
            <Select
              value={channel}
              onChange={setChannel}
              options={CHANNEL_OPTIONS}
              placeholder="All sources"
            />
          </div>
        </div>

        {loading ? (
          <Loader message="Loading submissions..." />
        ) : isError ? (
          <div className="px-5 py-16 text-center text-sm text-gray-500">
            {errMsg(error)}
          </div>
        ) : submissions.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-gray-500">
            No submissions found.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-300 text-xs uppercase tracking-wider text-gray-500">
                    <th className="px-5 py-3 font-semibold">Producer</th>
                    <th className="px-5 py-3 font-semibold">Land</th>
                    <th className="px-5 py-3 font-semibold">Score</th>
                    <th className="px-5 py-3 font-semibold">Band</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Submitted</th>
                    <th className="px-5 py-3 text-right font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((s) => (
                    <tr
                      key={s.id}
                      className="border-b border-gray-300/70 last:border-0 hover:bg-gray-100/60"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => navigate(`/eligibility/${s.id}`)}
                            className="text-left font-medium text-gray-900 hover:text-primary hover:underline"
                          >
                            {s.full_name}
                          </button>
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${CHANNEL_STYLE[s.channel]}`}
                          >
                            {CHANNEL_LABEL[s.channel]}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500">{s.email}</div>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-gray-700">
                        {s.total_acres} acres
                        <div className="text-xs text-gray-500">{s.state}</div>
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-gray-900">
                        {s.score}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${CATEGORY_STYLE[s.final_category]}`}
                        >
                          {CATEGORY_LABEL[s.final_category]}
                        </span>
                        {s.final_category !== s.auto_category && (
                          <div className="mt-1 text-xs text-gray-500">
                            auto: {CATEGORY_LABEL[s.auto_category]}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[s.status]}`}
                        >
                          {STATUS_LABEL[s.status]}
                        </span>
                        {s.enrollment_id && (
                          <div className="mt-1 font-mono text-xs text-primary">
                            {s.enrollment_id}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-gray-500">
                        {formatDate(s.created_at)}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => navigate(`/eligibility/${s.id}`)}
                            className="text-sm font-medium text-primary hover:underline"
                          >
                            Review
                          </button>
                          <button
                            onClick={() => handleDelete(s)}
                            className="grid h-8 w-8 place-items-center rounded-lg text-gray-400 hover:bg-danger/5 hover:text-danger"
                            aria-label="Delete submission"
                            title="Delete submission"
                          >
                            <TrashIcon width={15} height={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col items-center justify-between gap-3 border-t border-gray-300 px-5 py-3 sm:flex-row">
              <p className="text-sm text-gray-500">
                Page <span className="font-semibold text-gray-700">{page}</span>{" "}
                of{" "}
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
