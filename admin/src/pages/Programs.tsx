import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUrlSearchSync } from "../lib/useUrlSearchSync";
import { useLiveData } from "../lib/useLiveData";
import {
  useListProgramsQuery,
  useDeleteProgramMutation,
  useSetProgramVisibilityMutation,
  type ProgramStatusFilter,
} from "../store/endpoints/programsApi";
import {
  useListPasProgramsQuery,
  type Program as SurveyLink,
} from "../store/endpoints/programAdminSurveyApi";
import { showSuccess, showError } from "../lib/toast";
import { useConfirmCascadeDelete } from "../lib/confirmDelete";
import Select from "../components/ui/Select";
import Toggle from "../components/ui/Toggle";
import Loader from "../components/Loader";
import ProgramShareModal from "../components/ProgramShareModal";
import ProgramStatusBadge from "../components/ProgramStatusBadge";
import {
  PlusIcon,
  EditIcon,
  EyeIcon,
  UsersIcon,
  TrashIcon,
  SearchIcon,
  ShareIcon,
  FileIcon,
  InboxIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "../components/icons";
import type { Program } from "../types";

function errMsg(err: unknown): string {
  return (
    (err as { message?: string })?.message ??
    "Something went wrong. Please try again."
  );
}

/**
 * Offers a program to the farmers already enrolled on the platform. It stays
 * locked until the program has a survey, because that survey is where a
 * farmer who taps through is sent; without one there is nothing to show.
 */
function ShowToFarmers({ program }: { program: Program }) {
  const [setVisibility, { isLoading }] = useSetProgramVisibilityMutation();

  async function flip(next: boolean) {
    try {
      await setVisibility({ id: program.id, showToFarmers: next }).unwrap();
      showSuccess(
        next
          ? `${program.name} is now shown to enrolled farmers.`
          : `${program.name} is no longer shown to enrolled farmers.`
      );
    } catch (err) {
      showError(errMsg(err));
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Toggle
        checked={program.show_to_farmers}
        onChange={flip}
        disabled={!program.has_survey}
        busy={isLoading}
        label={`Show ${program.name} to enrolled farmers`}
        title={
          program.has_survey
            ? "Show this program to farmers already enrolled on the platform"
            : "Add a survey to this program first"
        }
      />
      {!program.has_survey && (
        <span className="text-xs text-gray-500">Needs a survey</span>
      )}
    </div>
  );
}

const PAGE_SIZE = 10;
// The same four the badge on each row shows, so the filter can find every one
// of them - an ended program was missing here entirely.
const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "scheduled", label: "Scheduled" },
  { value: "ended", label: "Ended" },
  { value: "inactive", label: "Inactive" },
];

function limitLabel(p: Program): string {
  return `${p.enrolled_count} / ${p.user_limit === null ? "No Limit" : p.user_limit}`;
}

export default function Programs() {
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  useUrlSearchSync(setSearchInput);

  const { data, isLoading, isError, error, refetch } = useListProgramsQuery({
    page,
    limit: PAGE_SIZE,
    status: (status || undefined) as ProgramStatusFilter | undefined,
    search: search || undefined,
  });
  useLiveData(["programs", "enrollments"], refetch);
  const programs = data?.programs ?? [];
  const meta = data?.meta ?? null;

  const [deleteProgram] = useDeleteProgramMutation();
  const confirmDelete = useConfirmCascadeDelete();

  // Each program can carry one survey (from the Surveys module). The
  // link row holds the shareable public link.
  const { data: surveyLinks, refetch: refetchLinks } = useListPasProgramsQuery();
  useLiveData(["program_admin_survey"], refetchLinks);
  const surveyByProgram = useMemo(() => {
    const m = new Map<string, SurveyLink>();
    for (const l of surveyLinks ?? []) if (l.program_id) m.set(l.program_id, l);
    return m;
  }, [surveyLinks]);

  const [share, setShare] = useState<SurveyLink | null>(null);

  useEffect(() => {
    setPage(1);
  }, [status, search]);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  async function handleDelete(program: Program) {
    const ok = await confirmDelete({
      title: "Delete this program and everything in it?",
      message:
        `"${program.name}" is deleted along with its survey, everything ` +
        "producers sent to it, the farmers enrolled and the work recorded " +
        "against it. Keeping any of it without the program would only put " +
        "wrong numbers on the dashboard.",
      summaryPath: `/programs/${program.id}/deletion-summary`,
    });
    if (!ok) return;
    try {
      await deleteProgram(program.id).unwrap();
      showSuccess("Program deleted.");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  const totalPages = meta?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Programs</h1>
          <p className="mt-1 text-sm text-gray-500">
            {meta
              ? `${meta.total.toLocaleString()} program(s)`
              : "Manage schemes and enrolled farmers"}
          </p>
        </div>
        <button onClick={() => navigate("/programs/new")} className="btn-primary">
          <PlusIcon width={18} height={18} />
          Add program
        </button>
      </div>

      <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <SearchIcon
            width={18}
            height={18}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
          />
          <input
            type="text"
            placeholder="Search by name or code"
            className="input-field pl-10"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            maxLength={100}
          />
        </div>
        <Select
          value={status}
          onChange={setStatus}
          options={STATUS_OPTIONS}
          className="sm:w-40"
        />
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <Loader message="Loading programs..." />
        ) : isError ? (
          <div className="px-5 py-16 text-center text-sm text-gray-500">
            {errMsg(error)}
          </div>
        ) : programs.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-gray-500">
            No programs found.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-300 text-xs uppercase tracking-wider text-gray-500">
                    <th className="px-5 py-3 font-semibold">Program</th>
                    <th className="px-5 py-3 font-semibold">Type</th>
                    <th className="px-5 py-3 font-semibold">Enrolled / Limit</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Show To Enrolled Farmers</th>
                    <th className="px-5 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {programs.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-gray-300/70 last:border-0 hover:bg-gray-100/60"
                    >
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() => navigate(`/programs/${p.id}`)}
                          className="text-left font-medium text-gray-900 hover:text-primary hover:underline"
                        >
                          {p.name}
                        </button>
                        {p.code && (
                          <div className="text-xs text-gray-500">{p.code}</div>
                        )}
                      </td>
                      <td className="px-5 py-3.5 capitalize text-gray-700">
                        {p.type || "-"}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-gray-700">
                        {limitLabel(p)}
                      </td>
                      <td className="px-5 py-3.5">
                        <ProgramStatusBadge program={p} />
                      </td>
                      <td className="px-5 py-3.5">
                        <ShowToFarmers program={p} />
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => navigate(`/programs/${p.id}`)}
                            className="grid h-8 w-8 place-items-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-primary"
                            title="View details"
                          >
                            <EyeIcon width={16} height={16} />
                          </button>
                          <button
                            onClick={() => navigate(`/programs/${p.id}/farmers`)}
                            className="grid h-8 w-8 place-items-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-primary"
                            title="Enrolled farmers"
                          >
                            <UsersIcon width={16} height={16} />
                          </button>
                          {/* Share shows for every program that has a survey;
                              the survey icon adds or changes it. */}
                          {surveyByProgram.get(p.id) && (
                            <button
                              onClick={() =>
                                setShare(surveyByProgram.get(p.id) ?? null)
                              }
                              className="grid h-8 w-8 place-items-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-primary"
                              title="Share survey link"
                            >
                              <ShareIcon width={16} height={16} />
                            </button>
                          )}
                          {/* Straight to what came in for this program, with
                              the program already filtered. Keyed on the
                              program, not its current survey, so submissions
                              made before the survey was changed still show. */}
                          <button
                            onClick={() =>
                              navigate(`/survey-submissions?program=${p.id}`)
                            }
                            className="grid h-8 w-8 place-items-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-primary"
                            title="Survey submissions for this program"
                          >
                            <InboxIcon width={16} height={16} />
                          </button>
                          <button
                            onClick={() => navigate(`/programs/${p.id}/survey`)}
                            className="grid h-8 w-8 place-items-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-primary"
                            title={
                              surveyByProgram.get(p.id)
                                ? "Survey and contract"
                                : "Add a survey and contract"
                            }
                          >
                            <FileIcon width={16} height={16} />
                          </button>
                          <button
                            onClick={() => navigate(`/programs/${p.id}/edit`)}
                            className="grid h-8 w-8 place-items-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-primary"
                            title="Edit"
                          >
                            <EditIcon width={16} height={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(p)}
                            className="grid h-8 w-8 place-items-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-danger"
                            title="Delete"
                          >
                            <TrashIcon width={16} height={16} />
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

      {share && (
        <ProgramShareModal
          id={share.id}
          name={share.name}
          link={share.link}
          onClose={() => setShare(null)}
        />
      )}
    </div>
  );
}
