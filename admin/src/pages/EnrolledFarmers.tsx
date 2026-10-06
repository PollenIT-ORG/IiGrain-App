import { Fragment, useEffect, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  useGetProgramQuery,
  useListEnrollmentsPagedQuery,
  useSetEnrollmentAssessorMutation,
  useGetEnrollmentAssessmentsQuery,
  useUnenrollMutation,
} from "../store/endpoints/programsApi";
import { useListUsersQuery } from "../store/endpoints/usersApi";
import { showSuccess, showError } from "../lib/toast";
import { scopeFor } from "../lib/programScope";
import { useHere } from "../lib/returnTo";
import { useProgramCrumbs } from "../lib/useProgramCrumbs";
import { useDialog } from "../components/ui/DialogProvider";
import Select from "../components/ui/Select";
import Loader from "../components/Loader";
import Breadcrumbs from "../components/ui/Breadcrumbs";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon,
  SearchIcon,
  TrashIcon,
} from "../components/icons";
import type {
  EnrollmentAssessmentSide,
  Program,
  ProgramEnrollment,
} from "../types";

function errMsg(err: unknown): string {
  return (
    (err as { message?: string })?.message ??
    "Something went wrong. Please try again."
  );
}

const PAGE_SIZE = 10;

export default function EnrolledFarmers() {
  const { id = "" } = useParams();
  const { data: program } = useGetProgramQuery(id, { skip: !id });
  const programCrumbs = useProgramCrumbs(id);

  return (
    <EnrolledFarmersModule
      programId={id}
      className="space-y-6"
      header={(total) => (
        <div>
          <Breadcrumbs
            className="mb-2"
            items={[...programCrumbs, { label: "Enrolled farmers in assessment" }]}
          />
          <h1 className="text-2xl font-bold text-gray-900">
            Enrolled Farmers in Assessment
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {program ? program.name : " "}
            {total !== null ? ` · ${total.toLocaleString()} enrolled` : ""}
          </p>
        </div>
      )}
    />
  );
}

export function EnrolledFarmersModule({
  programId: id,
  header,
  className,
}: {
  programId: string;
  header: (total: number | null) => ReactNode;
  className: string;
}) {
  const { confirm } = useDialog();

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [assessorFilter, setAssessorFilter] = useState("");

  const { data, isLoading, isFetching, isError, error } =
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
    <div className={className}>
      {header(meta ? meta.total : null)}

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

function EnrollmentRow({
  programId,
  enrollment: e,
  assessorOptions,
  confirm,
}: {
  programId: string;
  enrollment: ProgramEnrollment;
  assessorOptions: { value: string; label: string }[];
  confirm: ReturnType<typeof useDialog>["confirm"];
}) {
  const navigate = useNavigate();
  const { to } = scopeFor(programId);
  const here = useHere();

  // Which submission the Review link opens: the farmer's, else the assessor's.
  const reviewTarget = (row: {
    farmer: EnrollmentAssessmentSide;
    assessor: EnrollmentAssessmentSide;
  }): string | null => row.farmer.assessmentId ?? row.assessor.assessmentId;

  // A submitted assessment opens on the review screen, where it is scored.
  const openReview = (assessmentId: string | null) =>
    assessmentId
      ? () => navigate(to(`/submissions/${assessmentId}`), { state: here })
      : undefined;
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
              // Each field opens on its own page, where its submitted
              // assessments are listed.
              e.fields.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => navigate(to(`/fields/${f.field_id}`), { state: here })}
                  className="inline-flex rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 hover:bg-primary/10 hover:text-primary"
                  title={`Open ${f.field_name}${f.farm_name ? ` - ${f.farm_name}` : ""}`}
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
                              onClick={() =>
                                navigate(to(`/fields/${row.field.id}`), { state: here })
                              }
                              className="text-left font-medium text-gray-900 hover:text-primary hover:underline"
                            >
                              {row.field.name}
                            </button>
                          </td>
                          <td className="px-4 py-2">
                            <SubmitStatus
                              side={row.farmer}
                              onOpen={openReview(row.farmer.assessmentId)}
                            />
                          </td>
                          <td className="px-4 py-2">
                            <SubmitStatus
                              side={row.assessor}
                              onOpen={openReview(row.assessor.assessmentId)}
                            />
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex items-center justify-end gap-3">
                              <button
                                onClick={() =>
                                  navigate(to(`/fields/${row.field.id}`), { state: here })
                                }
                                title="The field, with everything submitted for it"
                                className="text-sm font-medium text-gray-600 hover:text-primary hover:underline"
                              >
                                View
                              </button>
                              {reviewTarget(row) && (
                                <button
                                  onClick={openReview(reviewTarget(row))}
                                  title={
                                    row.farmer.assessmentId
                                      ? "Score and approve the farmer's assessment"
                                      : "Score and approve the assessor's assessment"
                                  }
                                  className="text-sm font-medium text-primary hover:underline"
                                >
                                  Review
                                </button>
                              )}
                              {row.farmer.submitted && row.assessor.submitted && (
                                <button
                                  onClick={() =>
                                    navigate(to(`/fields/${row.field.id}/comparison`), {
                                      state: here,
                                    })
                                  }
                                  title="The farmer's answers next to the assessor's"
                                  className="text-sm font-medium text-primary hover:underline"
                                >
                                  Compare
                                </button>
                              )}
                            </div>
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
  onOpen,
}: {
  side: EnrollmentAssessmentSide;
  onOpen?: () => void;
}) {
  if (side.submitted) {
    const label = (
      <>
        <span className="h-1.5 w-1.5 rounded-full bg-success" />
        Submitted{side.percentage !== null ? ` · ${side.percentage}%` : ""}
        {side.reviewStatus === "approved" ? " · Approved" : ""}
      </>
    );
    // A submitted side opens its own review screen, farmer or assessor alike.
    return onOpen ? (
      <button
        type="button"
        onClick={onOpen}
        title="Open this submission to score and approve it"
        className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-semibold text-success hover:bg-success/20"
      >
        {label}
      </button>
    ) : (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-semibold text-success">
        {label}
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
