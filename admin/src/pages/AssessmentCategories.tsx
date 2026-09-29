import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  useListCategoriesQuery,
  useListTemplatesQuery,
  useDeleteCategoryMutation,
  useUpdateCategoryMutation,
  useReorderCategoriesMutation,
  useImportQuestionsMutation,
  useImportTemplateFileMutation,
  useSetTemplateLockMutation,
} from "../store/endpoints/assessmentApi";
import { useUpdateProgramMutation } from "../store/endpoints/programsApi";
import { showSuccess, showError } from "../lib/toast";
import { errMsg } from "../lib/errMsg";
import { useDialog } from "../components/ui/DialogProvider";
import { BLANK, BLANK_LABEL, useAssessmentScope } from "../lib/assessmentScope";
import { downloadApiFile } from "../lib/downloadApiFile";
import { useHere } from "../lib/returnTo";
import { ImportResultModal, ReasonNote, TemplateBadges } from "../components/AssessmentTemplateUi";
import AssessmentSourceModal, {
  type AssessmentSourceChoice,
} from "../components/AssessmentSourceModal";
import QuestionKindModal from "../components/QuestionKindModal";
import ImportTargetModal from "../components/ImportTargetModal";
import TemplateImportModal from "../components/TemplateImportModal";
import { QUESTION_KIND_LABELS } from "../lib/questionTypes";
import Loader from "../components/Loader";
import Breadcrumbs from "../components/ui/Breadcrumbs";
import Select from "../components/ui/Select";
import {
  PlusIcon,
  EditIcon,
  TrashIcon,
  GripIcon,
  UploadIcon,
  FileIcon,
} from "../components/icons";
import type {
  AssessmentCategory,
  AssessmentImportResult,
  AssessmentTemplate,
  Program,
} from "../types";

// The server takes spreadsheets up to this size.
const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

function ActiveBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
      <span className="h-1.5 w-1.5 rounded-full bg-success" />
      Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-500">
      <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
      Inactive
    </span>
  );
}

interface SortableRowProps {
  category: AssessmentCategory;
  editable: boolean;
  // An input based category is one form, so it reads as fields rather than questions.
  isForm: boolean;
  onEdit: (id: string) => void;
  onToggle: (cat: AssessmentCategory) => void;
  onDelete: (cat: AssessmentCategory) => void;
  onViewQuestions: (id: string) => void;
}

function SortableRow({ category, editable, isForm, onEdit, onToggle, onDelete, onViewQuestions }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: category.id, disabled: !editable });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr ref={setNodeRef} style={style} className="hover:bg-gray-50">
      {editable && (
        <td className="w-8 px-3 py-3 text-gray-400 cursor-grab active:cursor-grabbing">
          <button {...attributes} {...listeners} className="p-1 rounded hover:bg-gray-200">
            <GripIcon width={16} height={16} />
          </button>
        </td>
      )}
      <td className="px-4 py-3 text-sm text-gray-500 tabular-nums">{category.sort_order}</td>
      <td className="px-4 py-3">
        <p className="text-sm font-semibold text-gray-900">{category.name}</p>
        {category.description && (
          <p className="mt-0.5 text-xs text-gray-500 line-clamp-1">{category.description}</p>
        )}
      </td>
      <td className="px-4 py-3">
        <button
          onClick={() => onViewQuestions(category.id)}
          className="text-sm font-medium text-primary hover:underline"
        >
          {category.question_count} {isForm ? "field" : "question"}{category.question_count !== 1 ? "s" : ""}
        </button>
      </td>
      <td className="px-4 py-3">
        <ActiveBadge active={category.is_active} />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onViewQuestions(category.id)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            {isForm ? "Form" : "Questions"}
          </button>
          {editable && (
            <>
              <button
                onClick={() => onToggle(category)}
                title={category.is_active ? "Deactivate" : "Activate"}
                className="grid h-8 w-8 place-items-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                {category.is_active ? (
                  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="7" width="20" height="14" rx="2" />
                    <path d="M16 7V5a4 4 0 0 0-8 0v2" />
                  </svg>
                ) : (
                  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="11" width="20" height="10" rx="2" />
                    <path d="M6 11V7a6 6 0 0 1 12 0v4" />
                  </svg>
                )}
              </button>
              <button
                onClick={() => onEdit(category.id)}
                title="Edit"
                className="grid h-8 w-8 place-items-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                <EditIcon width={15} height={15} />
              </button>
              <button
                onClick={() => onDelete(category)}
                title="Delete"
                className="grid h-8 w-8 place-items-center rounded-lg border border-danger/30 text-danger hover:bg-danger/5"
              >
                <TrashIcon width={15} height={15} />
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

// The program's own assessment, as the picker shows what is in use now.
const OWN = "own";

/** Which template a program starts from; only while nothing in the program has been answered. */
function ProgramTemplatePicker({ program, copy }: { program: Program; copy: AssessmentTemplate | undefined }) {
  const { data: templates, isLoading } = useListTemplatesQuery();
  const [updateProgram, { isLoading: saving }] = useUpdateProgramMutation();
  const [picking, setPicking] = useState<
    { mode: "blank" } | { mode: "existing"; template: AssessmentTemplate } | null
  >(null);

  const changeable = program.assessment_template_changeable !== false;
  // Any other template or program assessment can be started from; this program's own is what is in use.
  const choices = useMemo(
    () => (templates ?? []).filter((t) => t.is_active && t.id !== program.assessment_template_id),
    [templates, program.assessment_template_id]
  );
  const describe = (t: AssessmentTemplate): string =>
    `${t.name}${t.is_global && !/global/i.test(t.name) ? " (Global)" : ""}` +
    `${t.kind === "mcq" || t.kind === "input" ? ` - ${QUESTION_KIND_LABELS[t.kind]}` : ""}` +
    `, ${t.active_question_count} question${t.active_question_count === 1 ? "" : "s"}` +
    `${t.program_id ? ` (program: ${t.program_name ?? "another program"})` : ""}`;
  const options = useMemo(() => {
    const list = [
      {
        value: OWN,
        label: copy
          ? `${copy.name}${copy.kind === "mcq" || copy.kind === "input" ? ` - ${QUESTION_KIND_LABELS[copy.kind]}` : ""}` +
            `, ${copy.active_question_count} question${copy.active_question_count === 1 ? "" : "s"} (this program)`
          : "This program's assessment",
      },
      ...choices.map((t) => ({ value: t.id, label: describe(t) })),
    ];
    list.push({ value: BLANK, label: BLANK_LABEL });
    return list;
  }, [choices, copy]);

  // Every choice is settled in the dialog: blank needs a name and a kind, and
  // a template that is already there is used as it is or renamed for this program.
  function handleChange(value: string) {
    if (value === OWN) return;
    if (value === BLANK) {
      setPicking({ mode: "blank" });
      return;
    }
    const chosen = choices.find((t) => t.id === value);
    if (!chosen) return;
    setPicking({ mode: "existing", template: chosen });
  }

  // What the program loses by switching, said before it happens.
  function warningFor(chosen?: AssessmentTemplate): string | null {
    if ((copy?.question_count ?? 0) === 0) return null;
    return chosen
      ? `The program gets a fresh copy of "${chosen.name}". What its assessment holds now is replaced.`
      : "The program starts again with no categories and no questions. What its assessment holds now is removed.";
  }

  // The name goes on the program's own assessment, which is listed and reused under it.
  async function applyChoice(choice: AssessmentSourceChoice) {
    if (!picking) return;
    const chosen = picking.mode === "existing" ? picking.template : undefined;
    try {
      await updateProgram({
        id: program.id,
        body: {
          assessmentTemplateId: chosen ? chosen.id : "blank",
          ...(choice.kind ? { questionKind: choice.kind } : {}),
          ...(choice.name ? { assessmentTemplateName: choice.name } : {}),
        },
      }).unwrap();
      setPicking(null);
      showSuccess(choice.name ? `"${choice.name}" is now this program's assessment.` : "Assessment template changed.");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  return (
    <div className="space-y-2">
      <label className="label">Assessment template</label>
      <Select
        value={OWN}
        onChange={(v) => void handleChange(v)}
        options={options}
        disabled={!changeable || saving || isLoading}
        className="sm:max-w-md"
      />
      <p className="text-xs text-gray-500">
        {changeable
          ? "The program answers its own copy, so later changes to the template itself never reach it."
          : "Answers have already been given in this program, so its assessment template can no longer be changed."}
      </p>
      {copy && copy.active_question_count === 0 && (
        <ReasonNote>
          This program's assessment has no active questions yet. Farmers and assessors will have nothing to
          answer until questions are added or imported.
        </ReasonNote>
      )}

      {picking && (
        <AssessmentSourceModal
          mode={picking.mode}
          sourceName={picking.mode === "existing" ? picking.template.name : undefined}
          saving={saving}
          warning={warningFor(picking.mode === "existing" ? picking.template : undefined)}
          onConfirm={(choice) => void applyChoice(choice)}
          onClose={() => setPicking(null)}
        />
      )}
    </div>
  );
}

/** Freezes the questions of an assessment, or releases them while nothing has been submitted. */
function LockButton({ template }: { template: AssessmentTemplate }) {
  const { confirm } = useDialog();
  const [setLock, { isLoading }] = useSetTemplateLockMutation();
  const locked = template.locked_at !== null;

  // Once something is submitted the lock is the rule itself, so there is nothing to press.
  if (template.has_submissions) return null;

  async function handleClick() {
    const ok = await confirm({
      title: locked ? "Unlock this assessment?" : "Lock this assessment?",
      message: locked
        ? "Its categories and questions can be changed again."
        : "Its categories and questions can no longer be changed. You can unlock it until the first assessment is submitted.",
      confirmLabel: locked ? "Unlock" : "Lock",
    });
    if (!ok) return;
    try {
      await setLock({ id: template.id, locked: !locked }).unwrap();
      showSuccess(locked ? "Assessment unlocked." : "Assessment locked.");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  return (
    <button
      onClick={() => void handleClick()}
      disabled={isLoading}
      title={locked ? "Allow changes again" : "Freeze the categories and questions"}
      className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {locked ? "Unlock assessment" : "Lock assessment"}
    </button>
  );
}

export default function AssessmentCategories({ programId }: { programId?: string }) {
  const navigate = useNavigate();
  const { confirm } = useDialog();
  const here = useHere();
  const scope = useAssessmentScope(programId);
  const { template, templateId, rights, to } = scope;

  const { data, isLoading } = useListCategoriesQuery(templateId ?? "", { skip: !templateId });
  // A bare `data = []` default creates a new array every render, which makes the
  // effect below fire forever. Memoise so the reference is stable until data
  // actually changes.
  const categories = useMemo(() => data ?? [], [data]);
  const [deleteCategory] = useDeleteCategoryMutation();
  const [updateCategory] = useUpdateCategoryMutation();
  const [reorderCategories] = useReorderCategoriesMutation();
  const [importQuestions, { isLoading: importing }] = useImportQuestionsMutation();
  const [importTemplateFile, { isLoading: importingNew }] = useImportTemplateFileMutation();
  const [setProgramTemplate] = useUpdateProgramMutation();
  const [importResult, setImportResult] = useState<AssessmentImportResult | null>(null);
  // A file either fills what is open here, or starts a template of its own.
  const [choosingTarget, setChoosingTarget] = useState(false);
  const [importingTemplate, setImportingTemplate] = useState(false);
  // The empty sheet comes in two flavours, so the examples match what is being built.
  const [pickingSample, setPickingSample] = useState(false);

  const [ordered, setOrdered] = useState<AssessmentCategory[]>([]);
  useEffect(() => { setOrdered(categories); }, [categories]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const fileRef = useRef<HTMLInputElement>(null);

  async function handleImportAsTemplate(name: string, file: File) {
    const form = new FormData();
    form.append("name", name);
    form.append("file", file);
    try {
      const result = await importTemplateFile(form).unwrap();
      setImportingTemplate(false);
      // A program with answers keeps its assessment, so the new template only
      // joins the list and is left for another program to use.
      if (programId && scope.program?.assessment_template_changeable !== false) {
        await setProgramTemplate({
          id: programId,
          body: { assessmentTemplateId: result.template.id },
        }).unwrap();
        showSuccess(`"${result.template.name}" made, and this program now answers its own copy.`);
      } else if (programId) {
        showSuccess(
          `"${result.template.name}" made. This program has answers already, so its own assessment is unchanged.`
        );
      } else {
        showSuccess(`Template created. ${result.created} question(s) imported.`);
        navigate(`/assessments/templates/${result.template.id}`);
      }
      if (result.problems.length) setImportResult(result);
    } catch (err) {
      const problems = ((err as { fieldErrors?: { field: string; message: string }[] }).fieldErrors ?? [])
        .map((f) => ({ where: f.field, message: f.message }))
        .filter((p) => p.where && p.message);
      if (problems.length) setImportResult({ created: 0, skipped: problems.length, problems });
      else showError(errMsg(err));
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !templateId) return;
    try {
      if (!/\.(xlsx|xls)$/i.test(file.name)) {
        showError("Choose an Excel file (.xlsx or .xls).");
        return;
      }
      if (file.size > MAX_IMPORT_BYTES) {
        showError("This file is larger than 5 MB. Split it into smaller files.");
        return;
      }
      const form = new FormData();
      form.append("file", file);
      const result = await importQuestions({ templateId, form }).unwrap();
      if (result.problems.length) {
        setImportResult(result);
      } else {
        showSuccess(`Import complete. ${result.created} question(s) added.`);
      }
    } catch (err) {
      // When nothing could be used, the server lists every place it went wrong; show them all.
      const problems = ((err as { fieldErrors?: { field: string; message: string }[] }).fieldErrors ?? [])
        .map((f) => ({ where: f.field, message: f.message }))
        .filter((p) => p.where && p.message);
      if (problems.length) setImportResult({ created: 0, skipped: problems.length, problems });
      else showError(errMsg(err));
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !templateId) return;

    const prev = ordered;
    const oldIndex = ordered.findIndex((c) => c.id === active.id);
    const newIndex = ordered.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(ordered, oldIndex, newIndex);
    setOrdered(reordered);

    try {
      await reorderCategories({
        templateId,
        items: reordered.map((c, i) => ({ id: c.id, sortOrder: i })),
      }).unwrap();
      showSuccess("Order saved.");
    } catch (err) {
      showError(errMsg(err));
      setOrdered(prev);
    }
  }

  async function handleToggle(cat: AssessmentCategory) {
    try {
      await updateCategory({ id: cat.id, body: { isActive: !cat.is_active } }).unwrap();
      showSuccess(`Category ${cat.is_active ? "deactivated" : "activated"}.`);
    } catch (err) {
      showError(errMsg(err));
    }
  }

  async function handleDelete(cat: AssessmentCategory) {
    const ok = await confirm({
      title: "Delete category?",
      message: `"${cat.name}" and all its questions will be removed from this template. Programs and templates already copied from it keep theirs.`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await deleteCategory(cat.id).unwrap();
      showSuccess("Category deleted.");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  if (scope.loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader size="md" />
      </div>
    );
  }
  if (scope.failed || !template) {
    return (
      <div className="card px-5 py-16 text-center text-sm text-gray-500">
        This assessment could not be loaded. It may have been removed, or you may not have access to it.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stacked on a phone so the title and buttons are not squashed side by side. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          {programId ? (
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
              Assessment
            </h2>
          ) : (
            <>
              <Breadcrumbs
                className="mb-2"
                items={[{ label: "Assessments", to: "/assessments" }, { label: template.name }]}
              />
              <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold text-gray-900">
                {template.name}
                <TemplateBadges template={template} />
              </h1>
              {template.program_id !== null && template.program_name && (
                <p className="mt-1 text-sm text-gray-500">The copy used by the program {template.program_name}.</p>
              )}
            </>
          )}
          <p className="mt-1 text-sm text-gray-500">
            {template.kind === "input"
              ? 'Each category is one form the farmer fills in. Click "Form" to build its fields.'
              : rights.editCategories
                ? 'Drag rows to reorder. Click "Questions" to manage questions in a category.'
                : 'Click "Questions" to see the questions in a category.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:flex-shrink-0">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleImport}
          />
          <button
            onClick={() => setPickingSample(true)}
            title="An empty sheet to fill in and import"
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <FileIcon width={16} height={16} />
            Download empty template
          </button>
          {template.question_count > 0 && (
            <button
              onClick={() =>
                void downloadApiFile(
                  `/assessments/templates/${template.id}/questions/export`,
                  `${template.name}.xlsx`
                )
              }
              title="This assessment as a spreadsheet, ready to edit and import again"
              className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <FileIcon width={16} height={16} />
              Download this assessment
            </button>
          )}
          <button
            onClick={() => setChoosingTarget(true)}
            disabled={importing || importingNew || !rights.editQuestions}
            title={rights.questionsReason ?? "Add questions from a spreadsheet"}
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <UploadIcon width={16} height={16} />
            {importing || importingNew ? "Importing..." : "Import Excel"}
          </button>
          <LockButton template={template} />
          {rights.editCategories && (
            <button
              onClick={() => navigate(to("/categories/new"), { state: here })}
              title="Add a category to this template"
              className="btn-primary flex items-center gap-2"
            >
              <PlusIcon width={18} height={18} />
              New Category
            </button>
          )}
        </div>
      </div>

      {programId && scope.program && <ProgramTemplatePicker program={scope.program} copy={template} />}

      {rights.questionsReason && <ReasonNote>{rights.questionsReason}</ReasonNote>}
      {programId && !rights.questionsReason && template.program_id === null && (
        <ReasonNote>
          This program still shares {template.name} with other programs, so a question changed here changes
          for all of them.
        </ReasonNote>
      )}

      <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-xs leading-relaxed text-gray-600 [overflow-wrap:anywhere]">
        <span className="font-semibold text-gray-700">Excel import - </span>
        {template.kind === "input" ? (
          <>
            Start from the empty template: one sheet per form, the sheet name is the form name, and a form
            that does not exist yet is created. The{" "}
            <code className="rounded bg-gray-200 px-1 py-0.5">Start here</code> page only explains the file
            and is never imported, and a tab still named{" "}
            <code className="rounded bg-gray-200 px-1 py-0.5">Your form</code> is skipped, so rename it
            first. Every field takes a column, so field one is column B, field
            two is column C, and so on. Column A names the lines:{" "}
            <code className="rounded bg-gray-200 px-1 py-0.5">Field</code> is required,{" "}
            <code className="rounded bg-gray-200 px-1 py-0.5">Answer type</code> takes Short text,
            Description, Number, Date, Yes or No or Multiple choice, and a multiple choice field writes its
            answers on the{" "}
            <code className="rounded bg-gray-200 px-1 py-0.5">Answers</code> line as{" "}
            <code className="rounded bg-gray-200 px-1 py-0.5">No till = 3 | Reduced till = 2</code>. The
            other lines are optional:{" "}
            <code className="rounded bg-gray-200 px-1 py-0.5">Highest score</code>,{" "}
            <code className="rounded bg-gray-200 px-1 py-0.5">Evidence</code> and{" "}
            <code className="rounded bg-gray-200 px-1 py-0.5">Description</code> (Off, Optional or
            Required),{" "}
            <code className="rounded bg-gray-200 px-1 py-0.5">Field code</code> and{" "}
            <code className="rounded bg-gray-200 px-1 py-0.5">Guidance</code>. Fields with a problem are
            skipped and listed after the import.
          </>
        ) : (
          <>
            Start from the empty template: one row per question. Each row&apos;s{" "}
            <code className="rounded bg-gray-200 px-1 py-0.5">Section</code> names its category, and one that
            does not exist yet is created, and{" "}
            <code className="rounded bg-gray-200 px-1 py-0.5">QuestionText</code> is required.{" "}
            <code className="rounded bg-gray-200 px-1 py-0.5">AnswerType</code> takes Short text,
            Description, Number, Date, Yes or No or Multiple choice, and a multiple choice row writes its
            answers in{" "}
            <code className="rounded bg-gray-200 px-1 py-0.5">Answers</code> as{" "}
            <code className="rounded bg-gray-200 px-1 py-0.5">No till = 3 | Reduced till = 2</code>. Other
            optional columns: <code className="rounded bg-gray-200 px-1 py-0.5">MaxScore</code>,{" "}
            <code className="rounded bg-gray-200 px-1 py-0.5">Evidence</code> and{" "}
            <code className="rounded bg-gray-200 px-1 py-0.5">Description</code> (Off, Optional or
            Required), <code className="rounded bg-gray-200 px-1 py-0.5">QuestionCode</code> and{" "}
            <code className="rounded bg-gray-200 px-1 py-0.5">GuidanceNote</code>. Rows with a problem are
            skipped and listed after the import.
          </>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader size="md" />
          </div>
        ) : ordered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <p className="text-gray-500">No categories yet.</p>
            {rights.editCategories && (
              <button
                onClick={() => navigate(to("/categories/new"), { state: here })}
                className="mt-3 text-sm font-medium text-primary hover:underline"
              >
                Create the first category
              </button>
            )}
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={rights.editCategories ? handleDragEnd : undefined}>
            <SortableContext items={ordered.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              <table className="w-full min-w-[760px] text-left">
                <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  <tr>
                    {rights.editCategories && <th className="w-8 px-3 py-3" />}
                    <th className="px-4 py-3">Order</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Questions</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {ordered.map((cat) => (
                    <SortableRow
                      key={cat.id}
                      category={cat}
                      editable={rights.editCategories}
                      isForm={template.kind === "input"}
                      onEdit={(id) => navigate(to(`/categories/${id}/edit`), { state: here })}
                      onToggle={handleToggle}
                      onDelete={handleDelete}
                      onViewQuestions={(id) => navigate(to(`/categories/${id}/questions`), { state: here })}
                    />
                  ))}
                </tbody>
              </table>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {choosingTarget && (
        <ImportTargetModal
          assessmentName={template.name}
          forProgram={Boolean(programId)}
          canReplace={scope.program?.assessment_template_changeable !== false}
          onPick={(target) => {
            setChoosingTarget(false);
            if (target === "existing") fileRef.current?.click();
            else setImportingTemplate(true);
          }}
          onClose={() => setChoosingTarget(false)}
        />
      )}

      {importingTemplate && (
        <TemplateImportModal
          saving={importingNew}
          onImport={(name, file) => void handleImportAsTemplate(name, file)}
          onClose={() => setImportingTemplate(false)}
        />
      )}

      {pickingSample && (
        <QuestionKindModal
          title="Which empty template?"
          subtitle="A multiple choice sheet lists the questions as rows; an input based one comes as a form per sheet."
          onPick={(kind) => {
            setPickingSample(false);
            void downloadApiFile(
              `/assessments/import-sample?kind=${kind}`,
              `assessment-${kind}-template.xlsx`
            );
          }}
          onClose={() => setPickingSample(false)}
        />
      )}

      {importResult && <ImportResultModal result={importResult} onClose={() => setImportResult(null)} />}
    </div>
  );
}
