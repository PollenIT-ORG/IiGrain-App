import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useListTemplatesQuery,
  useCreateTemplateMutation,
  useUpdateTemplateMutation,
  useDeleteTemplateMutation,
  useMakeTemplateGlobalMutation,
  useImportTemplateFileMutation,
  useListTemplatesPageQuery,
} from "../store/endpoints/assessmentApi";
import { useAuth } from "../store/useAuth";
import { useLiveData } from "../lib/useLiveData";
import { showSuccess, showError } from "../lib/toast";
import { errMsg } from "../lib/errMsg";
import { isClean } from "../lib/validation";
import { useDialog } from "../components/ui/DialogProvider";
import { templateRights } from "../lib/assessmentScope";
import { QUESTION_KIND_LABELS } from "../lib/questionTypes";
import { AssessmentModal, ImportResultModal, TemplateBadges } from "../components/AssessmentTemplateUi";
import TemplateImportModal from "../components/TemplateImportModal";
import QuestionKindModal from "../components/QuestionKindModal";
import { downloadApiFile } from "../lib/downloadApiFile";
import Select from "../components/ui/Select";
import Loader from "../components/Loader";
import {
  PlusIcon,
  EditIcon,
  TrashIcon,
  UploadIcon,
  FileIcon,
  SearchIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "../components/icons";
import type { AssessmentImportResult, AssessmentTemplate, QuestionKind } from "../types";

const NAME_MAX = 150;
const PAGE_SIZE = 20;

type KindFilter = "all" | QuestionKind;

const KIND_FILTERS: { value: KindFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "mcq", label: "MCQ based" },
  { value: "input", label: "Input based" },
];
const DESCRIPTION_MAX = 500;

const ACTION = "inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-gray-300 disabled:hover:text-gray-700";

function validateDetails(name: string, description: string): Record<string, string | null> {
  const trimmed = name.trim();
  return {
    name: !trimmed
      ? "Template name is required."
      : trimmed.length > NAME_MAX
        ? `Template name must be ${NAME_MAX} characters or fewer.`
        : null,
    description: description.trim().length > DESCRIPTION_MAX ? `Description must be ${DESCRIPTION_MAX} characters or fewer.` : null,
  };
}

export default function AssessmentTemplates() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { confirm } = useDialog();
  // Every template, for the Global default and the copy list; the table reads one page at a time.
  const { data: templates, refetch } = useListTemplatesQuery();
  const [updateTemplate] = useUpdateTemplateMutation();
  const [deleteTemplate] = useDeleteTemplateMutation();
  const [makeGlobal] = useMakeTemplateGlobalMutation();
  useLiveData(["assessments", "programs"], () => {
    void refetch();
    void refetchPage();
  });

  const [importTemplateFile, { isLoading: importing }] = useImportTemplateFileMutation();
  const [creatingFrom, setCreatingFrom] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [pickingSample, setPickingSample] = useState(false);
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // The search waits for typing to stop, and any change of filter starts again at page one.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);
  useEffect(() => {
    setPage(1);
  }, [search, kindFilter]);

  const {
    data: pageData,
    isLoading,
    isFetching,
    isError,
    error,
    refetch: refetchPage,
  } = useListTemplatesPageQuery({
    page,
    limit: PAGE_SIZE,
    search: search || undefined,
    kind: kindFilter === "all" ? undefined : kindFilter,
  });
  // The server sends the Global templates first, then the newest.
  const shown = pageData?.templates ?? [];
  const totalPages = pageData?.meta.totalPages ?? 1;
  const total = pageData?.meta.total ?? 0;
  // A new template starts as a copy of the multiple choice Global one, when there is one.
  const defaultBase = templates?.find((t) => t.is_global && t.kind === "mcq")?.id ?? "blank";
  const [importResult, setImportResult] = useState<AssessmentImportResult | null>(null);
  const [editing, setEditing] = useState<AssessmentTemplate | null>(null);
  const isPlatformAdmin = user?.role === "admin" || user?.role === "super_admin";

  async function handleImportTemplate(name: string, file: File) {
    const form = new FormData();
    form.append("name", name);
    form.append("file", file);
    try {
      const result = await importTemplateFile(form).unwrap();
      setImportOpen(false);
      showSuccess(`Template created. ${result.created} question(s) imported.`);
      if (result.problems.length) setImportResult(result);
      else navigate(`/assessments/templates/${result.template.id}`);
    } catch (err) {
      // When nothing could be used, the server lists every place it went wrong.
      const problems = ((err as { fieldErrors?: { field: string; message: string }[] }).fieldErrors ?? [])
        .map((f) => ({ where: f.field, message: f.message }))
        .filter((p) => p.where && p.message);
      if (problems.length) setImportResult({ created: 0, skipped: problems.length, problems });
      else showError(errMsg(err));
    }
  }

  async function handleToggle(t: AssessmentTemplate) {
    try {
      await updateTemplate({ id: t.id, body: { isActive: !t.is_active } }).unwrap();
      showSuccess(t.is_active ? "Template switched off." : "Template switched on.");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  async function handleMakeGlobal(t: AssessmentTemplate) {
    const kindLabel = t.kind === "input" ? "input based" : "multiple choice";
    const ok = await confirm({
      title: `Make this the ${kindLabel} Global template?`,
      message: `"${t.name}" becomes the ${kindLabel} template new programs start from. The current ${kindLabel} Global template becomes an ordinary one; the other kind keeps its own.`,
      confirmLabel: "Make global",
    });
    if (!ok) return;
    try {
      await makeGlobal(t.id).unwrap();
      showSuccess("Global template updated.");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  async function handleDelete(t: AssessmentTemplate) {
    const ok = await confirm({
      title: "Delete this template?",
      message: `"${t.name}" and its questions will be removed. Programs already using a copy of it keep their own questions.`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await deleteTemplate(t.id).unwrap();
      showSuccess("Template deleted.");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assessments</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Every program answers its own copy of a template, so changing a template here never changes a
            program that already uses it. Multiple choice and input based each have their own Global
            template, which is where new programs start. Copy one or start blank to build your own.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:flex-shrink-0">
          <button
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            title="An empty sheet to fill in and import"
            onClick={() => setPickingSample(true)}
          >
            <FileIcon width={16} height={16} />
            Download empty template
          </button>
          <button
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            title="Build a template from a filled in spreadsheet"
            onClick={() => setImportOpen(true)}
          >
            <UploadIcon width={16} height={16} />
            Import Excel
          </button>
          <button className="btn-primary" onClick={() => setCreatingFrom(defaultBase)}>
            <PlusIcon width={16} height={16} />
            New template
          </button>
        </div>
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
            placeholder="Search by template or program name"
            className="input-field pl-10"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            maxLength={100}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter templates by kind">
        {KIND_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setKindFilter(f.value)}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
              kindFilter === f.value
                ? "border-primary bg-primary text-white"
                : "border-gray-300 bg-white text-gray-700 hover:border-primary hover:text-primary"
            }`}
          >
            {f.label}
          </button>
        ))}
        </div>
      </div>

      {isLoading ? (
        <Loader message="Loading templates..." />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-300 text-xs uppercase tracking-wider text-gray-500">
                  <th className="px-5 py-3 font-semibold">Template</th>
                  <th className="px-5 py-3 font-semibold">Categories</th>
                  <th className="px-5 py-3 font-semibold">Questions</th>
                  <th className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isError ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-16 text-center">
                      <p className="text-sm font-medium text-danger">{errMsg(error) || "Could not load templates."}</p>
                      <button className="btn-secondary mt-3" onClick={() => void refetchPage()}>
                        Try again
                      </button>
                    </td>
                  </tr>
                ) : !shown.length ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-16 text-center text-sm text-gray-500">
                      {search || kindFilter !== "all" ? "Nothing matches this search." : "No templates yet."}
                    </td>
                  </tr>
                ) : (
                  shown.map((t) => {
                    const rights = templateRights(t, user);
                    // A program's own assessment is opened, copied and renamed here, and managed in its program.
                    const ofProgram = t.program_id !== null;
                    const deleteReason = t.is_global
                      ? "The Global template cannot be deleted."
                      : t.linked_program_count > 0
                        ? "A program uses this template, so it cannot be deleted."
                        : rights.questionsReason;
                    const globalReason =
                      t.linked_program_count > 0
                        ? "A program uses this template, so it cannot become the Global template."
                        : !t.is_active
                          ? "Switch this template on before making it the Global template."
                          : null;
                    return (
                      <tr key={t.id} className="border-b border-gray-300/70 last:border-0 hover:bg-gray-100/60">
                        <td className="px-5 py-3.5">
                          <span className="flex flex-wrap items-center gap-2 font-semibold text-gray-900">
                            {t.name}
                            <TemplateBadges template={t} />
                          </span>
                          {t.description && <p className="mt-0.5 line-clamp-1 text-xs text-gray-500">{t.description}</p>}
                        </td>
                        <td className="px-5 py-3.5 text-gray-700">{t.category_count}</td>
                        <td className="px-5 py-3.5 text-gray-700">
                          {t.active_question_count}
                          {t.question_count !== t.active_question_count && (
                            <span className="text-gray-400"> of {t.question_count}</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex flex-nowrap items-center justify-end gap-1 whitespace-nowrap">
                            <button
                              className={ACTION}
                              title={ofProgram ? "Open it in its program" : undefined}
                              onClick={() =>
                                navigate(
                                  ofProgram
                                    ? `/programs/${t.program_id}/edit?step=2`
                                    : `/assessments/templates/${t.id}`
                                )
                              }
                            >
                              {rights.editQuestions ? (
                                <>
                                  <EditIcon width={15} height={15} />
                                  Open
                                </>
                              ) : (
                                "View"
                              )}
                            </button>
                            <button className={ACTION} onClick={() => setCreatingFrom(t.id)}>
                              Copy
                            </button>
                            <button
                              className={ACTION}
                              disabled={!rights.editQuestions}
                              title={rights.questionsReason ?? "Rename or describe this template"}
                              onClick={() => setEditing(t)}
                            >
                              Rename
                            </button>
                            {!t.is_global && !ofProgram && (
                              <button
                                className={ACTION}
                                disabled={!rights.editQuestions}
                                title={rights.questionsReason ?? (t.is_active ? "Hide it from new programs" : "Offer it to new programs again")}
                                onClick={() => void handleToggle(t)}
                              >
                                {t.is_active ? "Switch off" : "Switch on"}
                              </button>
                            )}
                            {isPlatformAdmin && !t.is_global && !ofProgram && t.owner_id === null && (
                              <button
                                className={ACTION}
                                disabled={globalReason !== null}
                                title={globalReason ?? "Make this the template new programs start from"}
                                onClick={() => void handleMakeGlobal(t)}
                              >
                                Make global
                              </button>
                            )}
                            {!t.is_global && !ofProgram && (
                              <button
                                disabled={deleteReason !== null}
                                title={deleteReason ?? "Delete"}
                                onClick={() => void handleDelete(t)}
                                className="grid h-8 w-8 place-items-center rounded-lg text-gray-400 hover:bg-danger/5 hover:text-danger disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-400"
                                aria-label="Delete"
                              >
                                <TrashIcon width={15} height={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 border-t border-gray-300 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-500">
              {total} {total === 1 ? "assessment" : "assessments"} - page{" "}
              <span className="font-semibold text-gray-700">{page}</span> of{" "}
              <span className="font-semibold text-gray-700">{totalPages}</span>
              {isFetching && <span className="ml-2 text-gray-400">Loading...</span>}
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
        </div>
      )}

      {creatingFrom !== null && (
        <NewTemplateModal
          templates={templates ?? []}
          initialBase={creatingFrom}
          onClose={() => setCreatingFrom(null)}
          onCreated={(created) => {
            setCreatingFrom(null);
            navigate(`/assessments/templates/${created.id}`);
          }}
        />
      )}
      {editing && <EditTemplateModal template={editing} onClose={() => setEditing(null)} />}

      {importOpen && (
        <TemplateImportModal
          saving={importing}
          onImport={(name, file) => void handleImportTemplate(name, file)}
          onClose={() => setImportOpen(false)}
        />
      )}

      {importResult && <ImportResultModal result={importResult} onClose={() => setImportResult(null)} />}

      {pickingSample && (
        <QuestionKindModal
          title="Which empty template?"
          subtitle="A multiple choice sheet lists the questions as rows; an input based one comes as a form per sheet."
          onPick={(kind) => {
            setPickingSample(false);
            void downloadApiFile(`/assessments/import-sample?kind=${kind}`, `assessment-${kind}-template.xlsx`);
          }}
          onClose={() => setPickingSample(false)}
        />
      )}
    </div>
  );
}

function NewTemplateModal({
  templates,
  initialBase,
  onClose,
  onCreated,
}: {
  templates: AssessmentTemplate[];
  initialBase: string;
  onClose: () => void;
  onCreated: (created: AssessmentTemplate) => void;
}) {
  const [createTemplate, { isLoading }] = useCreateTemplateMutation();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [basedOn, setBasedOn] = useState(initialBase);
  // A blank template says which kind of questions it will hold.
  const [questionKind, setQuestionKind] = useState<QuestionKind>("mcq");
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const options = useMemo(
    () => [
      { value: "blank", label: "Blank: no categories or questions" },
      ...[...templates]
        .sort((a, b) => Number(b.is_global) - Number(a.is_global))
        .map((t) => ({
          value: t.id,
          label:
            `A copy of: ${t.name}` +
            `${t.is_global ? " (Global)" : ""}` +
            `${t.kind === "mcq" || t.kind === "input" ? ` - ${QUESTION_KIND_LABELS[t.kind]}` : ""}` +
            `${t.program_id ? ` (program: ${t.program_name ?? "another program"})` : ""}`,
        })),
    ],
    [templates]
  );

  async function handleSubmit() {
    const next = validateDetails(name, description);
    setErrors(next);
    if (!isClean(next)) return;
    try {
      const created = await createTemplate({
        name: name.trim(),
        description: description.trim() || null,
        basedOn,
        ...(basedOn === "blank" ? { questionKind } : {}),
      }).unwrap();
      showSuccess("Template created.");
      onCreated(created);
    } catch (err) {
      showError(errMsg(err));
    }
  }

  return (
    <AssessmentModal title="New assessment template" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label htmlFor="template-name" className="label">
            Template name <span className="text-danger">*</span>
          </label>
          <input
            id="template-name"
            className={`input-field ${errors.name ? "input-error" : ""}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={NAME_MAX}
            placeholder="e.g. Rice farms 2026"
            autoFocus
          />
          {errors.name && <p className="field-error">{errors.name}</p>}
        </div>
        <div>
          <label htmlFor="template-description" className="label">
            Description
          </label>
          <textarea
            id="template-description"
            className={`input-field min-h-[70px] resize-y ${errors.description ? "input-error" : ""}`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={DESCRIPTION_MAX}
            rows={2}
          />
          {errors.description && <p className="field-error">{errors.description}</p>}
        </div>
        <div>
          <label className="label">Start from</label>
          <Select value={basedOn} onChange={setBasedOn} options={options} />
          {basedOn === "blank" && (
            <div className="mt-4">
              <label className="label">What kind of questions</label>
              <Select
                value={questionKind}
                onChange={(v) => setQuestionKind(v as QuestionKind)}
                options={[
                  { value: "mcq", label: "Multiple choice, each answer carries a score" },
                  { value: "input", label: "Input based, an admin scores the answers in review" },
                ]}
              />
            </div>
          )}
          <p className="mt-1.5 text-xs text-gray-500">
            A copy starts with the categories and questions of its source. Everything can be changed or imported afterwards.
          </p>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={isLoading} onClick={() => void handleSubmit()}>
            {isLoading ? "Creating..." : "Create template"}
          </button>
        </div>
      </div>
    </AssessmentModal>
  );
}

function EditTemplateModal({ template, onClose }: { template: AssessmentTemplate; onClose: () => void }) {
  const [updateTemplate, { isLoading }] = useUpdateTemplateMutation();
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description ?? "");
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  async function handleSubmit() {
    const next = validateDetails(name, description);
    setErrors(next);
    if (!isClean(next)) return;
    try {
      await updateTemplate({
        id: template.id,
        body: { name: name.trim(), description: description.trim() || null },
      }).unwrap();
      showSuccess("Template updated.");
      onClose();
    } catch (err) {
      showError(errMsg(err));
    }
  }

  return (
    <AssessmentModal title="Rename template" subtitle={template.name} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label htmlFor="edit-template-name" className="label">
            Template name <span className="text-danger">*</span>
          </label>
          <input
            id="edit-template-name"
            className={`input-field ${errors.name ? "input-error" : ""}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={NAME_MAX}
            autoFocus
          />
          {errors.name && <p className="field-error">{errors.name}</p>}
        </div>
        <div>
          <label htmlFor="edit-template-description" className="label">
            Description
          </label>
          <textarea
            id="edit-template-description"
            className={`input-field min-h-[70px] resize-y ${errors.description ? "input-error" : ""}`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={DESCRIPTION_MAX}
            rows={2}
          />
          {errors.description && <p className="field-error">{errors.description}</p>}
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={isLoading} onClick={() => void handleSubmit()}>
            {isLoading ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>
    </AssessmentModal>
  );
}
