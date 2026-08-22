import { Fragment, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  useGetProgramQuery,
  useListEnrollmentsQuery,
  useEnrollFarmerMutation,
  useSetEnrollmentAssessorMutation,
  useGetEnrollmentAssessmentsQuery,
  useUnenrollMutation,
} from "../store/endpoints/programsApi";
import {
  useListPasProgramsQuery,
  usePasSubmissionStatsQuery,
} from "../store/endpoints/programAdminSurveyApi";
import { useListUsersQuery } from "../store/endpoints/usersApi";
import { useListFieldsQuery } from "../store/endpoints/fieldsApi";
import { showSuccess, showError } from "../lib/toast";
import { useDialog } from "../components/ui/DialogProvider";
import Select from "../components/ui/Select";
import ProgramStatusBadge, { programStatus } from "../components/ProgramStatusBadge";
import ProgramSubmissionCards from "../components/ProgramSubmissionCards";
import ProgramShareModal from "../components/ProgramShareModal";
import Loader from "../components/Loader";
import { useLiveData } from "../lib/useLiveData";
import {
  ChevronLeftIcon,
  EditIcon,
  EyeIcon,
  PlusIcon,
  TrashIcon,
  FileIcon,
  InboxIcon,
  ShareIcon,
} from "../components/icons";
import type { Program, ProgramEnrollment } from "../types";

function errMsg(err: unknown): string {
  return (
    (err as { message?: string })?.message ??
    "Something went wrong. Please try again."
  );
}

export default function ProgramDetail() {
  const navigate = useNavigate();
  const { id = "" } = useParams();
  const { confirm } = useDialog();

  const {
    data: program,
    isLoading,
    isError,
    error,
  } = useGetProgramQuery(id, { skip: !id });
  const { data: enrollments = [], isFetching: enrollLoading } =
    useListEnrollmentsQuery(id, { skip: !id });

  if (isLoading) {
    return <Loader variant="fullPage" message="Loading program..." />;
  }
  if (isError || !program) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate("/programs")}
          className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-primary"
        >
          <ChevronLeftIcon width={16} height={16} />
          Back to programs
        </button>
        <div className="card px-5 py-16 text-center text-sm text-gray-500">
          {errMsg(error) || "Program not found."}
        </div>
      </div>
    );
  }

  const isFull =
    program.user_limit !== null && program.enrolled_count >= program.user_limit;

  return (
    <div className="space-y-6">
      <div>
        <button
          onClick={() => navigate("/programs")}
          className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-primary"
        >
          <ChevronLeftIcon width={16} height={16} />
          Back to programs
        </button>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{program.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {program.code && (
                <span className="inline-flex rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                  {program.code}
                </span>
              )}
              <span className="inline-flex rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {program.enrolled_count} /{" "}
                {program.user_limit === null ? "No Limit" : program.user_limit}{" "}
                enrolled
              </span>
              <ProgramStatusBadge program={program} />
            </div>
          </div>
          <button
            onClick={() => navigate(`/programs/${program.id}/edit`)}
            className="btn-secondary"
          >
            <EditIcon width={16} height={16} />
            Edit program
          </button>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
          Details
        </h2>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Detail label="Type" value={program.type} />
          <Detail label="Start date" value={program.start_date} />
          <Detail label="End date" value={program.end_date} />
          <Detail
            label="Enrollment limit"
            value={program.user_limit === null ? "No Limit" : String(program.user_limit)}
          />
          <Detail label="Organization" value={program.org_name} />
          <div className="sm:col-span-2 lg:col-span-3">
            <Detail label="Description" value={program.description} />
          </div>
        </dl>
      </div>

      <SurveyPanel program={program} />

      <EnrollPanel program={program} enrollments={enrollments} isFull={isFull} />

      <EnrolledList
        program={program}
        enrollments={enrollments}
        loading={enrollLoading}
        confirm={confirm}
      />
    </div>
  );
}

/**
 * The program's survey: how it is doing, and everything you would want to do
 * with it. A program with no survey yet says so and offers to build one.
 */
function SurveyPanel({ program }: { program: Program }) {
  const navigate = useNavigate();
  const [sharing, setSharing] = useState(false);

  const { data: links, refetch } = useListPasProgramsQuery();
  const { data: stats, refetch: refetchStats } = usePasSubmissionStatsQuery(
    { programId: program.id }
  );
  useLiveData(["program_admin_survey"], () => {
    void refetch();
    void refetchStats();
  });

  const link = (links ?? []).find((l) => l.program_id === program.id) ?? null;

  if (!link) {
    return (
      <div className="card space-y-4 p-6 text-center">
        <div>
          <h2 className="text-base font-bold text-gray-900">No survey yet</h2>
          <p className="mx-auto mt-1 max-w-lg text-sm text-gray-500">
            A survey is how producers apply to this program. Build its questions
            and pick the contract they sign, then share the link.
          </p>
        </div>
        <button
          className="btn-primary mx-auto"
          onClick={() => navigate(`/programs/${program.id}/survey`)}
        >
          <PlusIcon width={18} height={18} />
          Create the survey
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
            Survey
          </h2>
          <p className="mt-1 truncate text-lg font-bold text-gray-900">
            {link.template_name}
          </p>
          <p className="text-sm text-gray-500">
            Contract: {link.contract_template_name ?? "Global contract"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={() => setSharing(true)}>
            <ShareIcon width={16} height={16} />
            Share link
          </button>
          <button
            className="btn-secondary"
            onClick={() =>
              navigate(`/survey-submissions?program=${program.id}`)
            }
          >
            <InboxIcon width={16} height={16} />
            View submissions
          </button>
          <button
            className="btn-primary"
            onClick={() => navigate(`/programs/${program.id}/survey`)}
          >
            <FileIcon width={16} height={16} />
            Survey and contract
          </button>
        </div>
      </div>

      {/* The same six numbers as the submissions screen, for this program. */}
      <ProgramSubmissionCards
        stats={stats}
        active=""
        onPick={(status) =>
          navigate(
            `/survey-submissions?program=${program.id}${
              status ? `&status=${status}` : ""
            }`
          )
        }
      />

      {sharing && (
        <ProgramShareModal
          id={link.id}
          name={link.name}
          link={link.link}
          onClose={() => setSharing(false)}
        />
      )}
    </div>
  );
}

function EnrollPanel({
  program,
  enrollments,
  isFull,
}: {
  program: Program;
  enrollments: ProgramEnrollment[];
  isFull: boolean;
}) {
  const [farmerId, setFarmerId] = useState("");
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [assessorId, setAssessorId] = useState("");
  const [enrollFarmer, { isLoading: enrolling }] = useEnrollFarmerMutation();

  const { data: usersData } = useListUsersQuery({
    page: 1,
    limit: 100,
    role: "farmer",
    status: "active",
  });
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
  const enrolledIds = useMemo(
    () => new Set(enrollments.map((e) => e.farmer_id)),
    [enrollments]
  );
  const farmerOptions = [
    { value: "", label: "Select a farmer" },
    ...(usersData?.users ?? [])
      .filter((u) => !enrolledIds.has(u.id))
      .map((u) => ({
        value: u.id,
        label: u.full_name ? `${u.full_name} - ${u.email}` : u.email,
      })),
  ];

  const { data: fieldsData, isFetching: fieldsLoading } = useListFieldsQuery(
    { page: 1, limit: 100, ownerId: farmerId },
    { skip: !farmerId }
  );

  function toggleField(fieldId: string) {
    setSelectedFields((prev) =>
      prev.includes(fieldId)
        ? prev.filter((f) => f !== fieldId)
        : [...prev, fieldId]
    );
  }

  async function handleEnroll() {
    if (!farmerId) {
      showError("Select a farmer to enroll.");
      return;
    }
    if (selectedFields.length === 0) {
      showError("Select at least one field.");
      return;
    }
    try {
      await enrollFarmer({
        programId: program.id,
        body: {
          farmerId,
          fieldIds: selectedFields,
          assessorId: assessorId || null,
        },
      }).unwrap();
      showSuccess("Farmer enrolled.");
      setFarmerId("");
      setSelectedFields([]);
      setAssessorId("");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  const fields = fieldsData?.fields ?? [];

  // A program that has ended or been turned off is closed for new enrollments,
  // the same cutoff the backend enforces - so show why instead of an enroll form
  // that would only fail.
  const status = programStatus(program);
  const isClosed = status.label === "Ended" || status.label === "Inactive";

  return (
    <div className="card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
          Enroll a farmer
        </h2>
        {isClosed ? (
          <ProgramStatusBadge program={program} />
        ) : (
          isFull && (
            <span className="rounded-full bg-danger/10 px-2.5 py-1 text-xs font-semibold text-danger">
              Program full
            </span>
          )
        )}
      </div>

      {isClosed ? (
        <p className="text-sm text-gray-500">
          This program has {status.label === "Ended" ? "ended" : "been turned off"},
          so new farmers can no longer be enrolled.
        </p>
      ) : isFull ? (
        <p className="text-sm text-gray-500">
          This program has reached its enrollment limit. Increase the limit in
          “Edit program” or unenroll a farmer to add more.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="sm:w-96">
            <label className="label">Farmer</label>
            <Select
              value={farmerId}
              onChange={(v) => {
                setFarmerId(v);
                setSelectedFields([]);
              }}
              options={farmerOptions}
              placeholder="Select a farmer"
            />
          </div>

          {farmerId && (
            <div>
              <label className="label">Fields to include</label>
              {fieldsLoading ? (
                <Loader message="Loading fields..." />
              ) : fields.length === 0 ? (
                <p className="text-sm text-gray-500">
                  This farmer has no fields to enroll.
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {fields.map((f) => (
                    <label
                      key={f.id}
                      className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-100"
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary/30"
                        checked={selectedFields.includes(f.id)}
                        onChange={() => toggleField(f.id)}
                      />
                      <span className="font-medium text-gray-900">{f.name}</span>
                      {f.crop && (
                        <span className="text-xs text-gray-500">· {f.crop}</span>
                      )}
                    </label>
                  ))}
                </div>
              )}
              <p className="mt-2 text-xs text-gray-500">
                Pick only the fields relevant to this program (e.g. wheat fields).
              </p>
            </div>
          )}

          {farmerId && (
            <div className="sm:w-96">
              <label className="label">Assessor (optional)</label>
              <Select
                value={assessorId}
                onChange={setAssessorId}
                options={assessorOptions}
                placeholder="No assessor"
              />
              <p className="mt-1.5 text-xs text-gray-500">
                One assessor per farmer. They can assess this farmer's fields.
              </p>
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleEnroll}
              disabled={enrolling || !farmerId || selectedFields.length === 0}
              className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              <PlusIcon width={16} height={16} />
              Enroll farmer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function EnrolledList({
  program,
  enrollments,
  loading,
  confirm,
}: {
  program: Program;
  enrollments: ProgramEnrollment[];
  loading: boolean;
  confirm: ReturnType<typeof useDialog>["confirm"];
}) {
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

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-gray-300 px-5 py-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
          Enrolled farmers ({enrollments.length})
        </h2>
        <Link
          to={`/programs/${program.id}/farmers`}
          className="text-sm font-medium text-primary hover:underline"
        >
          Manage all →
        </Link>
      </div>
      {loading ? (
        <Loader message="Loading enrollments..." />
      ) : enrollments.length === 0 ? (
        <div className="px-5 py-12 text-center text-sm text-gray-500">
          No farmers enrolled yet. Use the panel above to add one.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-300 text-xs uppercase tracking-wider text-gray-500">
                <th className="px-5 py-3 font-semibold">Farmer</th>
                <th className="px-5 py-3 font-semibold">Enrolled fields</th>
                <th className="px-5 py-3 font-semibold">Assessor</th>
                <th className="px-5 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {enrollments.map((e) => (
                <EnrollmentRow
                  key={e.id}
                  program={program}
                  enrollment={e}
                  assessorOptions={assessorOptions}
                  confirm={confirm}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EnrollmentRow({
  program,
  enrollment: e,
  assessorOptions,
  confirm,
}: {
  program: Program;
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
      { programId: program.id, enrollmentId: e.id },
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
      await unenroll({ programId: program.id, enrollmentId: e.id }).unwrap();
      showSuccess("Farmer unenrolled.");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  async function handleAssessorChange(assessorId: string) {
    try {
      await setAssessor({
        programId: program.id,
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
        </td>
        <td className="px-5 py-3.5 align-middle">
          <div className="flex max-w-md flex-wrap items-center gap-1.5">
            {e.fields.length === 0 ? (
              <span className="text-xs text-gray-400">No fields</span>
            ) : (
              e.fields.map((f) => (
                <span
                  key={f.id}
                  className="inline-flex rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700"
                  title={f.farm_name ?? undefined}
                >
                  {f.field_name}
                </span>
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
              <span className="text-xs font-medium text-gray-500">Saving...</span>
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

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wider text-gray-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-gray-900">{value || "-"}</dd>
    </div>
  );
}
