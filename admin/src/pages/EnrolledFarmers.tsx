import { Fragment, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MODULES } from "../lib/fieldModules";
import { exportFarmWorkbook } from "../lib/farmWorkbookExport";
import { useLazyListModuleRecordsQuery, useLazyListModuleDocumentsQuery }
  from "../store/endpoints/fieldMonitoringApi";
import type { ModuleKey, ModuleRecord } from "../types";
import {
  useGetProgramQuery,
  useListEnrollmentsPagedQuery,
  useSetEnrollmentAssessorMutation,
  useGetEnrollmentAssessmentsQuery,
  useUnenrollMutation,
} from "../store/endpoints/programsApi";
import { useListUsersQuery } from "../store/endpoints/usersApi";
import { showSuccess, showError } from "../lib/toast";
import { useLiveData } from "../lib/useLiveData";
import { useDialog } from "../components/ui/DialogProvider";
import Select from "../components/ui/Select";
import Loader from "../components/Loader";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon,
  SearchIcon,
  TrashIcon,
} from "../components/icons";
import type { Program, ProgramEnrollment } from "../types";

function errMsg(err: unknown): string {
  return (
    (err as { message?: string })?.message ??
    "Something went wrong. Please try again."
  );
}

const PAGE_SIZE = 10;

export default function EnrolledFarmers() {
  const navigate = useNavigate();
  const { id = "" } = useParams();
  const { confirm } = useDialog();

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [assessorFilter, setAssessorFilter] = useState("");

  const { data: program } = useGetProgramQuery(id, { skip: !id });
  const { data, isLoading, isFetching, isError, error, refetch } =
    useListEnrollmentsPagedQuery(
      {
        programId: id,
        page,
        limit: PAGE_SIZE,
        search: search || undefined,
        assessor:
          assessorFilter === "assigned" || assessorFilter === "unassigned"
            ? assessorFilter
            : undefined,
      },
      { skip: !id }
    );
  const enrollments = data?.enrollments ?? [];
  const meta = data?.meta ?? null;

  useLiveData(["enrollments", "assignments"], refetch);

  const { data: assessorsData } = useListUsersQuery({
    page: 1,
    limit: 100,
    role: "assessor",
    status: "active",
  });
  const assessorOptions = [
    { value: "", label: "No assessor" },
    ...(assessorsData?.users ?? []).map((u) => ({
      value: u.id,
      label: u.full_name ? `${u.full_name} - ${u.email}` : u.email,
    })),
  ];

  useEffect(() => {
    setPage(1);
  }, [search, assessorFilter]);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const totalPages = meta?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      <div>
        <button
          onClick={() => navigate(`/programs/${id}`)}
          className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-primary"
        >
          <ChevronLeftIcon width={16} height={16} />
          Back to program
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Enrolled Farmers</h1>
        <p className="mt-1 text-sm text-gray-500">
          {program ? program.name : " "}
          {meta ? ` · ${meta.total.toLocaleString()} enrolled` : ""}
        </p>
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
            placeholder="Search enrolled farmers by name or email"
            className="input-field pl-10"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            maxLength={100}
          />
        </div>
        <Select
          value={assessorFilter}
          onChange={setAssessorFilter}
          options={[
            { value: "", label: "All assessor states" },
            { value: "assigned", label: "Assessor assigned" },
            { value: "unassigned", label: "No assessor" },
          ]}
          className="sm:w-52"
        />
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <Loader message="Loading enrolled farmers..." />
        ) : isError ? (
          <div className="px-5 py-16 text-center text-sm text-gray-500">
            {errMsg(error)}
          </div>
        ) : enrollments.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-gray-500">
            {search
              ? "No farmers match your search."
              : "No farmers enrolled yet."}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-300 text-xs uppercase tracking-wider text-gray-500">
                    <th className="px-5 py-3 font-semibold">Farmer</th>
                    <th className="px-5 py-3 font-semibold">Enrolled fields</th>
                    <th className="px-5 py-3 font-semibold">Assessor</th>
                    <th className="px-5 py-3 text-right font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody
                  className={isFetching ? "opacity-60 transition-opacity" : ""}
                >
                  {enrollments.map((e) => (
                    <EnrollmentRow
                      key={e.id}
                      programId={id}
                      programName={program?.name ?? ""}
                      programStart={program?.start_date ?? null}
                      enrollment={e}
                      assessorOptions={assessorOptions}
                      confirm={confirm}
                    />
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

/**
 * The whole farm as one workbook, in the client's own shape: a profile listing
 * every enrolled field, then a sheet per module holding the detail across all
 * of them.
 *
 * The records are fetched only when the button is pressed. Nine modules for
 * every field of every farm would be a lot to hold open on a list screen that
 * mostly nobody exports from.
 */
function FarmWorkbookButton({
  programId,
  programName,
  programStart,
  enrollment: e,
}: {
  programId: string;
  programName: string;
  programStart: string | null;
  enrollment: ProgramEnrollment;
}) {
  const [busy, setBusy] = useState(false);
  const [fetchRecords] = useLazyListModuleRecordsQuery();
  const [fetchDocs] = useLazyListModuleDocumentsQuery();

  async function run() {
    if (!e.fields.length) {
      showError("This farmer has no fields enrolled yet.");
      return;
    }
    setBusy(true);
    try {
      const byModule = {} as Record<
        ModuleKey,
        Array<ModuleRecord & { fieldName: string }>
      >;
      for (const def of MODULES) byModule[def.key] = [];
      const documents = [];

      for (const f of e.fields) {
        for (const def of MODULES) {
          const res = await fetchRecords(
            { programId, fieldId: f.field_id, module: def.key },
            true
          ).unwrap();
          byModule[def.key].push(
            ...res.records.map((r) => ({ ...r, fieldName: f.field_name }))
          );
        }
        const docs = await fetchDocs(
          { programId, fieldId: f.field_id },
          true
        ).unwrap();
        documents.push(...docs);
      }

      await exportFarmWorkbook({
        // Every field of one enrolment sits on the same farm in practice; the
        // first one names it.
        farmName: e.fields[0].farm_name ?? "Farm",
        programName,
        // Their template calls the program year simply "Year".
        year: (programStart ?? new Date().toISOString()).slice(0, 4),
        fields: e.fields.map((f) => ({
          fieldId: f.field_id,
          fieldName: f.field_name,
          areaAcres: f.area_acres,
        })),
        recordsByModule: byModule,
        documents,
      });
      showSuccess("Farm workbook downloaded.");
    } catch (err) {
      showError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={() => void run()}
      disabled={busy}
      className="grid h-8 w-8 place-items-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-primary disabled:opacity-50"
      title="Download the full farm workbook"
    >
      {busy ? (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-300 border-t-primary" />
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <path d="M7 10l5 5 5-5M12 15V3" />
        </svg>
      )}
    </button>
  );
}

function EnrollmentRow({
  programId,
  programName,
  programStart,
  enrollment: e,
  assessorOptions,
  confirm,
}: {
  programId: string;
  programName: string;
  programStart: string | null;
  enrollment: ProgramEnrollment;
  assessorOptions: { value: string; label: string }[];
  confirm: ReturnType<typeof useDialog>["confirm"];
}) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [unenroll] = useUnenrollMutation();
  const [setAssessor, { isLoading: savingAssessor }] =
    useSetEnrollmentAssessorMutation();
  const { data: assessments, isFetching: assessmentsLoading } =
    useGetEnrollmentAssessmentsQuery(
      { programId, enrollmentId: e.id },
      { skip: !expanded }
    );

  async function handleUnenroll() {
    const ok = await confirm({
      title: "Unenroll farmer?",
      message: `"${e.farmer_name || e.farmer_email}" will be removed from this program.`,
      confirmLabel: "Unenroll",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await unenroll({ programId, enrollmentId: e.id }).unwrap();
      showSuccess("Farmer unenrolled.");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  async function handleAssessorChange(assessorId: string) {
    try {
      await setAssessor({
        programId,
        enrollmentId: e.id,
        assessorId: assessorId || null,
      }).unwrap();
      showSuccess(assessorId ? "Assessor assigned." : "Assessor removed.");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  return (
    <Fragment>
      <tr className="border-b border-gray-300/70 hover:bg-gray-100/60 align-middle">
        <td className="px-5 py-3.5 align-middle">
          <div className="font-medium text-gray-900">{e.farmer_name || "-"}</div>
          <div className="text-xs text-gray-500">{e.farmer_email}</div>
          {e.enrollment_id && (
            // Quoted back to us when a farmer calls, so it is worth showing.
            <div className="mt-0.5 font-mono text-xs text-gray-500">
              {e.enrollment_id}
            </div>
          )}
        </td>
        <td className="px-5 py-3.5 align-middle">
          <div className="flex max-w-md flex-wrap items-center gap-1.5">
            {e.fields.length === 0 ? (
              <span className="text-xs text-gray-400">No fields</span>
            ) : (
              // Each field opens its own monitoring record for this program,
              // which is the only place those records make sense.
              e.fields.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() =>
                    navigate(`/programs/${programId}/fields/${f.field_id}/monitoring`)
                  }
                  className="inline-flex rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 hover:bg-primary/10 hover:text-primary"
                  title={`Open monitoring records${f.farm_name ? ` - ${f.farm_name}` : ""}`}
                >
                  {f.field_name}
                </button>
              ))
            )}
          </div>
        </td>
        <td className="px-5 py-3.5 align-middle">
          <div className="flex items-center gap-2">
            <Select
              value={e.assessor_id ?? ""}
              onChange={handleAssessorChange}
              options={assessorOptions}
              className="w-56"
              searchable
              disabled={savingAssessor}
            />
            {savingAssessor && (
              <span className="text-xs font-medium text-gray-500">
                Saving...
              </span>
            )}
          </div>
        </td>
        <td className="px-5 py-3.5 align-middle">
          <div className="flex items-center justify-end gap-1">
            <FarmWorkbookButton
              programId={programId}
              programName={programName}
              programStart={programStart}
              enrollment={e}
            />
            <button
              onClick={() => setExpanded((v) => !v)}
              className={`grid h-8 w-8 place-items-center rounded-lg hover:bg-gray-100 hover:text-primary ${
                expanded ? "text-primary" : "text-gray-500"
              }`}
              title="View assessments"
            >
              <EyeIcon width={16} height={16} />
            </button>
            <button
              onClick={handleUnenroll}
              className="grid h-8 w-8 place-items-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-danger"
              title="Unenroll"
            >
              <TrashIcon width={16} height={16} />
            </button>
          </div>
        </td>
      </tr>

      {expanded && (
        <tr className="border-b border-gray-300/70 bg-gray-100/40">
          <td colSpan={4} className="px-5 py-4">
            {assessmentsLoading ? (
              <Loader message="Loading assessments..." />
            ) : !assessments || assessments.fields.length === 0 ? (
              <p className="text-sm text-gray-500">No fields to show.</p>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Assessment status - {e.farmer_name || e.farmer_email}
                </p>
                <div className="overflow-x-auto rounded-lg border border-gray-300 bg-white">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-gray-300 text-xs uppercase tracking-wider text-gray-500">
                        <th className="px-4 py-2 font-semibold">Field</th>
                        <th className="px-4 py-2 font-semibold">Farmer</th>
                        <th className="px-4 py-2 font-semibold">Assessor</th>
                        <th className="px-4 py-2 text-right font-semibold">
                          View
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {assessments.fields.map((row) => (
                        <tr
                          key={row.field.id}
                          className="border-b border-gray-300/70 last:border-0"
                        >
                          <td className="px-4 py-2">
                            <button
                              onClick={() => navigate(`/fields/${row.field.id}`)}
                              className="text-left font-medium text-gray-900 hover:text-primary hover:underline"
                            >
                              {row.field.name}
                            </button>
                          </td>
                          <td className="px-4 py-2">
                            <SubmitStatus side={row.farmer} />
                          </td>
                          <td className="px-4 py-2">
                            <SubmitStatus side={row.assessor} />
                          </td>
                          <td className="px-4 py-2 text-right">
                            <button
                              onClick={() => navigate(`/fields/${row.field.id}`)}
                              className="text-sm font-medium text-primary hover:underline"
                            >
                              Open
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </td>
        </tr>
      )}
    </Fragment>
  );
}

function SubmitStatus({
  side,
}: {
  side: { submitted: boolean; percentage: number | null };
}) {
  if (side.submitted) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-semibold text-success">
        <span className="h-1.5 w-1.5 rounded-full bg-success" />
        Submitted{side.percentage !== null ? ` · ${side.percentage}%` : ""}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-200 px-2.5 py-0.5 text-xs font-semibold text-gray-600">
      <span className="h-1.5 w-1.5 rounded-full bg-gray-500" />
      Pending
    </span>
  );
}

export type { Program };
