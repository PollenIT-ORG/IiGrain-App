import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  useListPasSubmissionsQuery,
  useLazyListPasSubmissionsQuery,
  usePasSubmissionStatsQuery,
  useDeletePasSubmissionMutation,
  useWithdrawPasSubmissionMutation,
  useListPasProgramsQuery,
  CATEGORY_LABEL,
  STATUS_LABEL,
  STATUS_DOT,
  type Submission,
} from "../store/endpoints/programAdminSurveyApi";
import { REFERRAL_SOURCES } from "./survey/states";
import { errMsg } from "../lib/errMsg";
import { scopeFor } from "../lib/programScope";
import { useHere, type ReturnState } from "../lib/returnTo";
import { showSuccess, showError } from "../lib/toast";
import { useDialog } from "../components/ui/DialogProvider";
import Select from "../components/ui/Select";
import Loader from "../components/Loader";
import ProgramSubmissionCards from "../components/ProgramSubmissionCards";
import Portal from "../components/ui/Portal";
import { ChevronLeftIcon, ChevronRightIcon } from "../components/icons";
import { fmtDate, fmtTime } from "../lib/datetime";
import { downloadWorkbook, fileStamp } from "../lib/workbook";

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "registered", label: "Registered" },
  { value: "under_review", label: "Under Review" },
  { value: "contract_sent", label: "Contract Sent" },
  { value: "enrolled", label: "Enrolled" },
  { value: "not_qualified", label: "Not Qualified" },
  { value: "withdrawn", label: "Withdrawn" },
];

const REFERRAL_OPTIONS = [
  { value: "", label: "All sources" },
  ...REFERRAL_SOURCES.map((s) => ({ value: s, label: s })),
];

const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-indigo-100 text-indigo-700",
  "bg-purple-100 text-purple-700",
  "bg-teal-100 text-teal-700",
  "bg-orange-100 text-orange-700",
  "bg-cyan-100 text-cyan-700",
  "bg-pink-100 text-pink-700",
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}
function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function formatDate(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "-", time: "" };
  return { date: fmtDate(d), time: fmtTime(d) };
}

export default function ProgramSubmissions() {
  return (
    <SurveySubmissionsModule
      className="space-y-6"
      header={(exportButton) => (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Survey Submissions</h1>
            <p className="mt-1 text-sm text-gray-500">
              View and manage submissions to your surveys.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">{exportButton}</div>
        </div>
      )}
    />
  );
}

export function SurveySubmissionsModule({
  programId: lockedProgramId,
  header,
  className,
  openPath,
  linkState,
}: {
  programId?: string;
  header: (exportButton: ReactNode) => ReactNode;
  className: string;
  openPath?: (submissionId: string) => string;
  linkState?: ReturnState;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const { confirm } = useDialog();
  const scope = scopeFor(lockedProgramId);
  const here = useHere();
  const [deleteSubmission] = useDeletePasSubmissionMutation();
  const [withdrawSubmission] = useWithdrawPasSubmissionMutation();

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [menu, setMenu] = useState<{
    id: string;
    top: number;
    left: number;
  } | null>(null);

  // The URL owns the status filter so the dashboard/sidebar can deep-link in,
  // and the program filter so Programs can send someone straight to one
  // program's submissions.
  const status = params.get("status") ?? "";
  const programId = lockedProgramId ?? params.get("program") ?? "";
  const [referral, setReferral] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  function setParam(key: string, next: string) {
    const p = new URLSearchParams(params);
    if (next) p.set(key, next);
    else p.delete(key);
    setParams(p, { replace: true, state: location.state });
  }

  function setStatus(next: string) {
    setParam("status", next);
  }

  function setProgramId(next: string) {
    setParam("program", next);
  }

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => setPage(1), [status, programId, referral, from, to, search, perPage]);

  const filters = {
    status: status || undefined,
    programId: programId || undefined,
    referral: referral || undefined,
    createdFrom: from || undefined,
    createdTo: to || undefined,
    search: search || undefined,
  };

  // The cards count what the table lists, so they take the same filters. Status
  // is the one they leave out: picking a status would empty the other five.
  const statsFilters = {
    programId: filters.programId,
    referral: filters.referral,
    createdFrom: filters.createdFrom,
    createdTo: filters.createdTo,
    search: filters.search,
  };

  const { data, isLoading, isFetching, isError, error } =
    useListPasSubmissionsQuery({ page, limit: perPage, ...filters });
  const { data: stats } =
    usePasSubmissionStatsQuery(statsFilters);
  const { data: programs } = useListPasProgramsQuery();
  const [triggerExport] = useLazyListPasSubmissionsQuery();

  // Only surveys attached to a real program from the Programs module; legacy
  // rows without one are not programs and must not appear here. The value is
  // the program, not the survey link: a program that changed its survey has
  // more than one link, and all of it belongs under the one program.
  const programOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of programs ?? [])
      if (p.program_id && !seen.has(p.program_id)) seen.set(p.program_id, p.name);
    return [
      { value: "", label: "All programs" },
      ...[...seen].map(([value, label]) => ({ value, label })),
    ];
  }, [programs]);


  const submissions = data?.submissions ?? [];
  const meta = data?.meta ?? null;
  const totalPages = meta?.totalPages ?? 1;
  const total = meta?.total ?? 0;
  const loading = isLoading || isFetching;


  const hasFilters = Boolean(
    status || (!lockedProgramId && programId) || referral || from || to || search
  );

  function clearFilters() {
    // Both live in the URL, so they go in one write - two would each start
    // from the same stale search string and put the other one back.
    const p = new URLSearchParams(params);
    p.delete("status");
    p.delete("program");
    setParams(p, { replace: true, state: location.state });
    setReferral("");
    setFrom("");
    setTo("");
    setSearchInput("");
    setSearch("");
  }

  async function handleWithdraw(s: Submission) {
    setMenu(null);
    const ok = await confirm({
      title: "Withdraw this submission?",
      message: `${s.full_name}'s submission will be marked as withdrawn.`,
      confirmLabel: "Withdraw",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await withdrawSubmission(s.id).unwrap();
      showSuccess("Submission withdrawn.");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  async function handleDelete(s: Submission) {
    setMenu(null);
    const ok = await confirm({
      title: "Delete this submission?",
      message: `${s.full_name}'s survey submission will be removed. This cannot be undone.`,
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

  async function handleExport() {
    try {
      const res = await triggerExport({ page: 1, limit: 5000, ...filters }).unwrap();
      // The filters that produced this list are written into the file, so a
      // saved copy still says what it is.
      await exportSubmissions(res.submissions, [
        [
          "Program",
          programOptions.find((o) => o.value === programId)?.label ??
            "All programs",
        ],
        [
          "Status",
          STATUS_OPTIONS.find((o) => o.value === status)?.label ?? "All",
        ],
        ["Source", referral || "All sources"],
        [
          "Dates",
          from || to ? `${from || "any"} to ${to || "any"}` : "All time",
        ],
        ["Rows", String(res.submissions.length)],
      ]);
    } catch (err) {
      showError(errMsg(err));
    }
  }

  const showingFrom = total === 0 ? 0 : (page - 1) * perPage + 1;
  const showingTo = Math.min(page * perPage, total);
  const pages = useMemo(() => pageNumbers(page, totalPages), [page, totalPages]);

  function openSubmission(id: string) {
    navigate(openPath ? openPath(id) : scope.to(`/survey-submissions/${id}`), {
      state: linkState ?? here,
    });
  }

  return (
    <div className={className}>
      {header(
        <button onClick={handleExport} className="btn-secondary">
          <IconDownload />
          Export
        </button>
      )}

      {/* Stat cards, shared with the dashboard */}
      <ProgramSubmissionCards stats={stats} active={status} onPick={setStatus} />

      {/* Filters + table */}
      <div className="card overflow-hidden">
        {/* One line on a wide screen: the search takes whatever is left, the
            rest keep their size, and clearing them sits at the end. Narrower
            than that, they wrap rather than run off the card. */}
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-300 p-4 min-[1400px]:flex-nowrap">
          <div className="relative w-full min-w-[10rem] min-[1400px]:flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <IconSearch />
            </span>
            <input
              className="input-field pl-9"
              placeholder="Search by name, email or farm..."
              maxLength={100}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <Select
            value={referral}
            onChange={setReferral}
            options={REFERRAL_OPTIONS}
            placeholder="All sources"
            className="w-full min-w-0 sm:w-36"
          />
          {!lockedProgramId && (
            <Select
              value={programId}
              onChange={setProgramId}
              options={programOptions}
              placeholder="All programs"
              className="w-full min-w-0 sm:w-[9.5rem]"
            />
          )}
          <Select
            value={status}
            onChange={setStatus}
            options={STATUS_OPTIONS}
            placeholder="All Statuses"
            className="w-full min-w-0 sm:w-36"
          />
          <div className="flex shrink-0 items-center gap-1.5">
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => setFrom(e.target.value)}
              className="input-field w-[8.75rem] min-w-0"
              aria-label="From date"
            />
            <span className="text-gray-400">-</span>
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
              className="input-field w-[8.75rem] min-w-0"
              aria-label="To date"
            />
          </div>
          <button
            onClick={clearFilters}
            disabled={!hasFilters}
            title="Clear filters"
            aria-label="Clear filters"
            className="ml-auto grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-gray-300 text-gray-500 transition-colors hover:bg-gray-100 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-500"
          >
            <IconRotate />
          </button>
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
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-300 text-xs uppercase tracking-wider text-gray-500">
                    <th className="px-5 py-3 font-semibold">Producer</th>
                    <th className="px-5 py-3 font-semibold">Contact</th>
                    <th className="px-5 py-3 font-semibold">Referral</th>
                    <th className="px-5 py-3 font-semibold">Program</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Submitted On</th>
                    <th className="px-5 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((s) => {
                    const d = formatDate(s.created_at);
                    return (
                      <tr
                        key={s.id}
                        className="border-b border-gray-300/70 last:border-0 hover:bg-gray-100/60"
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <span
                              className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold ${avatarColor(s.email || s.full_name)}`}
                            >
                              {initials(s.full_name)}
                            </span>
                            <div>
                              <button
                                onClick={() => openSubmission(s.id)}
                                className="text-left font-semibold text-gray-900 hover:text-primary hover:underline"
                              >
                                {s.full_name}
                              </button>
                              <div className="text-xs text-gray-500">
                                {s.farm_name || s.state || "-"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="text-gray-700">{s.email}</div>
                          {s.phone && (
                            <div className="text-xs text-gray-500">{s.phone}</div>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-gray-700">
                          {s.referral_source || (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 font-medium text-gray-800">
                          {s.survey_name}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex items-center gap-2 whitespace-nowrap text-sm font-medium text-gray-700">
                            <span className={`h-2 w-2 rounded-full ${STATUS_DOT[s.status]}`} />
                            {STATUS_LABEL[s.status]}
                          </span>
                          {s.enrollment_id && (
                            <div className="mt-0.5 font-mono text-xs text-primary">
                              {s.enrollment_id}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="text-gray-700">{d.date}</div>
                          <div className="text-xs text-gray-500">{d.time}</div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openSubmission(s.id)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-primary/40 hover:text-primary"
                            >
                              <IconEye />
                              View
                            </button>
                            <button
                              onClick={(e) => {
                                const r = e.currentTarget.getBoundingClientRect();
                                setMenu((m) =>
                                  m?.id === s.id
                                    ? null
                                    : { id: s.id, top: r.bottom + 6, left: r.right - 160 }
                                );
                              }}
                              className="grid h-8 w-8 place-items-center rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-100"
                              aria-label="More actions"
                            >
                              <IconChevronDown />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col items-center justify-between gap-3 border-t border-gray-300 px-5 py-3 sm:flex-row">
              <p className="text-sm text-gray-500">
                Showing{" "}
                <span className="font-semibold text-gray-700">{showingFrom}</span>{" "}
                to <span className="font-semibold text-gray-700">{showingTo}</span>{" "}
                of{" "}
                <span className="font-semibold text-gray-700">{total}</span>{" "}
                submissions
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="grid h-9 w-9 place-items-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Previous page"
                >
                  <ChevronLeftIcon width={16} height={16} />
                </button>
                {pages.map((p, i) =>
                  p === "..." ? (
                    <span key={`e${i}`} className="px-1 text-gray-400">
                      ...
                    </span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`grid h-9 min-w-9 place-items-center rounded-lg px-2 text-sm font-medium transition-colors ${
                        p === page
                          ? "bg-primary text-white"
                          : "border border-gray-300 text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="grid h-9 w-9 place-items-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Next page"
                >
                  <ChevronRightIcon width={16} height={16} />
                </button>
                <Select
                  value={String(perPage)}
                  onChange={(v) => setPerPage(Number(v))}
                  options={[10, 20, 50].map((n) => ({
                    value: String(n),
                    label: `${n} / page`,
                  }))}
                  className="w-28"
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Row action menu - portalled so the card's overflow never clips it. */}
      {menu &&
        (() => {
          const s = submissions.find((x) => x.id === menu.id);
          if (!s) return null;
          return (
            <Portal>
              <button
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => setMenu(null)}
                aria-hidden="true"
                tabIndex={-1}
              />
              <div
                className="fixed z-50 w-40 overflow-hidden rounded-lg border border-gray-300 bg-white py-1 shadow-card-hover"
                style={{ top: menu.top, left: menu.left }}
              >
                <button
                  onClick={() => {
                    setMenu(null);
                    openSubmission(s.id);
                  }}
                  className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                >
                  Review
                </button>
                {s.status !== "withdrawn" && (
                  <button
                    onClick={() => handleWithdraw(s)}
                    className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Withdraw
                  </button>
                )}
                <button
                  onClick={() => handleDelete(s)}
                  className="block w-full px-4 py-2 text-left text-sm text-danger hover:bg-danger/5"
                >
                  Delete
                </button>
              </div>
            </Portal>
          );
        })()}
    </div>
  );
}

// Builds a page-number list with ellipses: 1 ... 4 5 6 ... 13
function pageNumbers(current: number, total: number): Array<number | "..."> {
  if (total <= 7)
    return Array.from({ length: total }, (_, i) => i + 1);
  const out: Array<number | "..."> = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) out.push("...");
  for (let p = start; p <= end; p++) out.push(p);
  if (end < total - 1) out.push("...");
  out.push(total);
  return out;
}

async function exportSubmissions(
  rows: Submission[],
  notes: Array<[string, string]>
): Promise<void> {
  await downloadWorkbook(`survey-submissions-${fileStamp()}`, [
    {
      name: "Submissions",
      title: "Survey submissions",
      notes,
      columns: [
        { header: "Name", width: 24 },
        { header: "Email", width: 30 },
        // A phone number is digits, not a quantity: left as a number Excel
        // shows it as 9.17729E+11.
        { header: "Phone", type: "text", width: 18 },
        { header: "Farm", width: 22 },
        { header: "State", width: 16 },
        { header: "Acres", type: "number", total: "sum", width: 12 },
        { header: "Referral", width: 18 },
        { header: "Score", type: "number", total: "average", width: 10 },
        { header: "Qualification", width: 15 },
        { header: "Status", width: 16 },
        { header: "Enrollment ID", type: "text", width: 20 },
        { header: "Submitted", type: "date", width: 24 },
      ],
      rows: rows.map((s) => [
        s.full_name,
        s.email,
        s.phone ?? "",
        s.farm_name ?? "",
        s.state ?? "",
        s.total_acres === null ? null : Number(s.total_acres),
        s.referral_source ?? "",
        s.score,
        CATEGORY_LABEL[s.final_category],
        STATUS_LABEL[s.status],
        s.enrollment_id ?? "",
        new Date(s.created_at),
      ]),
    },
  ]);
}

// --- icons ---------------------------------------------------------------
function IconSearch() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
  );
}
function IconDownload() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
  );
}
function IconEye() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
  );
}
function IconChevronDown() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
  );
}
function IconRotate() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v6h6M21 12A9 9 0 0 0 6 5.3L3 8" /><path d="M21 22v-6h-6M3 12a9 9 0 0 0 15 6.7l3-2.7" /></svg>
  );
}
