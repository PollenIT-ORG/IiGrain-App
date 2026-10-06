import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useGetProgramQuery } from "../store/endpoints/programsApi";
import {
  useListPasProgramsQuery,
  useSetPasProgramLockMutation,
  type Program as SurveyLink,
} from "../store/endpoints/programAdminSurveyApi";
import {
  useGetTemplateQuery,
  useSetTemplateLockMutation,
} from "../store/endpoints/assessmentApi";
import { useDialog } from "../components/ui/DialogProvider";
import { showSuccess, showError } from "../lib/toast";
import { useHere, useTrail } from "../lib/returnTo";
import ProgramStatusBadge from "../components/ProgramStatusBadge";
import ProgramShareModal from "../components/ProgramShareModal";
import Loader from "../components/Loader";
import Breadcrumbs from "../components/ui/Breadcrumbs";
import AssessmentCategories from "./AssessmentCategories";
import { SurveySubmissionsModule } from "./ProgramSubmissions";
import { EnrolledFarmersModule } from "./EnrolledFarmers";
import { EditIcon, PlusIcon, FileIcon, ShareIcon } from "../components/icons";
import type { Program } from "../types";

/** The survey attached to this program, if it has one. */
function useSurveyLink(programId: string): SurveyLink | null {
  const { data: links } = useListPasProgramsQuery();
  return (links ?? []).find((l) => l.program_id === programId) ?? null;
}

/** Locks the survey, which freezes its questions and opens the assessment to farmers. */
function SurveyLockButton({ link }: { link: SurveyLink }) {
  const { confirm } = useDialog();
  const [setLock, { isLoading }] = useSetPasProgramLockMutation();
  const locked = link.locked_at !== null;

  async function handleClick() {
    const ok = await confirm({
      title: locked ? "Unlock this survey?" : "Lock this survey?",
      message: locked
        ? "Its questions can be changed again, and farmers cannot start the assessment until it is locked again."
        : "Its questions can no longer be changed, and farmers can start this program's assessment.",
      confirmLabel: locked ? "Unlock survey" : "Lock survey",
    });
    if (!ok) return;
    try {
      await setLock({ id: link.id, locked: !locked }).unwrap();
      showSuccess(locked ? "Survey unlocked." : "Survey locked. Farmers can start the assessment.");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  return (
    <button className="btn-secondary" disabled={isLoading} onClick={() => void handleClick()}>
      {isLoading ? "Saving..." : locked ? "Unlock survey" : "Lock survey"}
    </button>
  );
}

/** Locks the assessment and the survey together, once the program has both. */
function ProgramLockButton({ program, link }: { program: Program; link: SurveyLink | null }) {
  const { confirm } = useDialog();
  const { data: template } = useGetTemplateQuery(program.assessment_template_id, {
    skip: !program.assessment_template_id,
  });
  const [setTemplateLock, { isLoading: savingTemplate }] = useSetTemplateLockMutation();
  const [setSurveyLock, { isLoading: savingSurvey }] = useSetPasProgramLockMutation();

  if (!link || !template) return null;

  const surveyLocked = link.locked_at !== null;
  const bothLocked = template.locked && surveyLocked;
  // An assessment locked by a submission cannot be released, so there is nothing left to undo.
  if (bothLocked && template.has_submissions) return null;

  const lock = !bothLocked;
  const saving = savingTemplate || savingSurvey;

  async function handleClick() {
    if (!link || !template) return;
    const ok = await confirm({
      title: lock ? "Lock the assessment and the survey?" : "Unlock the assessment and the survey?",
      message: lock
        ? "The questions of both are frozen, and farmers can start this program's assessment."
        : "Both can be changed again, and farmers cannot start the assessment until the survey is locked again.",
      confirmLabel: lock ? "Lock both" : "Unlock both",
    });
    if (!ok) return;
    try {
      if (lock ? template.locked_at === null : template.locked_at !== null) {
        await setTemplateLock({ id: template.id, locked: lock }).unwrap();
      }
      if (surveyLocked !== lock) {
        await setSurveyLock({ id: link.id, locked: lock }).unwrap();
      }
      showSuccess(lock ? "Assessment and survey locked." : "Assessment and survey unlocked.");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  return (
    <button className="btn-secondary" disabled={saving} onClick={() => void handleClick()}>
      {saving ? "Saving..." : lock ? "Lock assessment and survey" : "Unlock assessment and survey"}
    </button>
  );
}

function errMsg(err: unknown): string {
  return (
    (err as { message?: string })?.message ??
    "Something went wrong. Please try again."
  );
}

export default function ProgramDetail() {
  const navigate = useNavigate();
  const { id = "" } = useParams();
  const here = useHere();
  const trail = useTrail();
  const parents = trail ?? [{ label: "Programs", to: "/programs" }];

  const {
    data: program,
    isLoading,
    isError,
    error,
  } = useGetProgramQuery(id, { skip: !id });
  const link = useSurveyLink(id);

  if (isLoading) {
    return <Loader variant="fullPage" message="Loading program..." />;
  }
  if (isError || !program) {
    return (
      <div className="space-y-4">
        <Breadcrumbs items={[...parents, { label: "Program" }]} />
        <div className="card px-5 py-16 text-center text-sm text-gray-500">
          {errMsg(error) || "Program not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs
          className="mb-2"
          items={[...parents, { label: program.name }]}
        />
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
          <div className="flex flex-wrap gap-2">
            <ProgramLockButton program={program} link={link} />
            <button
              onClick={() => navigate(`/programs/${program.id}/edit`, { state: here })}
              className="btn-secondary"
            >
              <EditIcon width={16} height={16} />
              Edit program
            </button>
          </div>
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

      <AssessmentCategories programId={program.id} />

      <EnrolledFarmersModule
        programId={program.id}
        className="space-y-4"
        header={(total) => (
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
              Enrolled farmers in assessment{total !== null ? ` (${total})` : ""}
            </h2>
            <Link
              to={`/programs/${program.id}/farmers`}
              state={here}
              className="text-sm font-medium text-primary hover:underline"
            >
              Manage all →
            </Link>
          </div>
        )}
      />

      <SurveyPanel program={program} link={link} />
    </div>
  );
}

/**
 * The program's survey: how it is doing, and everything you would want to do
 * with it. A program with no survey yet says so and offers to build one.
 */
function SurveyPanel({ program, link }: { program: Program; link: SurveyLink | null }) {
  const navigate = useNavigate();
  const here = useHere();
  const [sharing, setSharing] = useState(false);

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
          onClick={() => navigate(`/programs/${program.id}/survey`, { state: here })}
        >
          <PlusIcon width={18} height={18} />
          Create the survey
        </button>
      </div>
    );
  }

  return (
    <>
      <SurveySubmissionsModule
        programId={program.id}
        className="space-y-4"
        header={(exportButton) => (
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
              <p className="text-sm text-gray-500">
                {link.locked_at
                  ? "Locked: the questions are fixed and farmers can start the assessment."
                  : "Not locked yet, so farmers cannot start this program's assessment."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn-secondary" onClick={() => setSharing(true)}>
                <ShareIcon width={16} height={16} />
                Share link
              </button>
              <SurveyLockButton link={link} />
              {exportButton}
              <button
                className="btn-primary"
                onClick={() => navigate(`/programs/${program.id}/survey`, { state: here })}
              >
                <FileIcon width={16} height={16} />
                Survey and contract
              </button>
            </div>
          </div>
        )}
      />

      {sharing && (
        <ProgramShareModal
          id={link.id}
          name={link.name}
          link={link.link}
          onClose={() => setSharing(false)}
        />
      )}
    </>
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
