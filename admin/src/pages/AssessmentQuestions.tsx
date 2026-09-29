import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
  useListQuestionsQuery,
  useDeleteQuestionMutation,
  useUpdateQuestionMutation,
  useReorderQuestionsMutation,
  useGetCategoryQuery,
} from "../store/endpoints/assessmentApi";
import { showSuccess, showError } from "../lib/toast";
import { errMsg } from "../lib/errMsg";
import { useDialog } from "../components/ui/DialogProvider";
import { useAssessmentCrumbs, useAssessmentScope } from "../lib/assessmentScope";
import { useHere, useReturnTo } from "../lib/returnTo";
import { ReasonNote } from "../components/AssessmentTemplateUi";
import Breadcrumbs from "../components/ui/Breadcrumbs";
import Loader from "../components/Loader";
import Select from "../components/ui/Select";
import {
  PlusIcon,
  EditIcon,
  TrashIcon,
  GripIcon,
  SearchIcon,
} from "../components/icons";
import QuestionKindModal from "../components/QuestionKindModal";
import CategoryFormBuilder from "./CategoryFormBuilder";
import { QUESTION_TYPE_LABELS } from "../lib/questionTypes";
import type { AssessmentQuestion, QuestionKind } from "../types";

function short(text: string | null): string {
  if (!text) return "-";
  return text.length > 40 ? `${text.slice(0, 40)}...` : text;
}

/** What the farmer answers, written for the list. */
function AnswerSummary({ question }: { question: AssessmentQuestion }) {
  return (
    <div className="space-y-1 text-xs text-gray-600">
      <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 font-semibold text-gray-700">
        {QUESTION_TYPE_LABELS[question.question_type]}
      </span>
      {question.question_type === "scored" ? (
        <div className="space-y-0.5">
          <p><span className="font-semibold text-gray-900">0:</span> {short(question.score0_description)}</p>
          <p><span className="font-semibold text-gray-900">1:</span> {short(question.score1_description)}</p>
          <p><span className="font-semibold text-gray-900">2:</span> {short(question.score2_description)}</p>
          <p><span className="font-semibold text-gray-900">3:</span> {short(question.score3_description)}</p>
        </div>
      ) : question.question_type === "mcq" ? (
        <div className="space-y-0.5">
          {question.options.map((o) => (
            <p key={o.id}>
              <span className="font-semibold text-gray-900">{o.score}:</span> {short(o.option_text)}
            </p>
          ))}
        </div>
      ) : (
        <p>Scored out of {question.max_score} in review</p>
      )}
      <p className="text-gray-500">
        Evidence {question.evidence_mode}, description {question.comment_mode}
      </p>
    </div>
  );
}

function ActiveBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">Active</span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">Inactive</span>
  );
}

interface SortableRowProps {
  question: AssessmentQuestion;
  editable: boolean;
  draggable: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}

function SortableRow({ question, editable, draggable, onEdit, onToggle, onDelete }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: question.id, disabled: !draggable });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <tr ref={setNodeRef} style={style} className="hover:bg-gray-50">
      {editable && (
        <td className="w-8 px-3 py-3 text-gray-400">
          <button
            {...attributes}
            {...listeners}
            disabled={!draggable}
            title={draggable ? "Drag to reorder" : "Clear filters to reorder"}
            className={`p-1 rounded ${
              draggable
                ? "cursor-grab active:cursor-grabbing hover:bg-gray-200"
                : "cursor-not-allowed opacity-40"
            }`}
          >
            <GripIcon width={14} height={14} />
          </button>
        </td>
      )}
      <td className="px-3 py-3 text-xs font-mono text-gray-500">
        {question.question_code ?? "-"}
      </td>
      <td className="px-4 py-3 max-w-xs">
        <p className="text-sm font-medium text-gray-900 line-clamp-2">{question.question_text}</p>
        {question.guidance_note && (
          <p className="mt-0.5 text-xs text-gray-500 line-clamp-1">{question.guidance_note}</p>
        )}
      </td>
      <td className="px-4 py-3">
        <AnswerSummary question={question} />
      </td>
      <td className="px-4 py-3">
        <ActiveBadge active={question.is_active} />
      </td>
      {editable && (
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              onClick={onToggle}
              title={question.is_active ? "Deactivate" : "Activate"}
              className="grid h-8 w-8 place-items-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
            >
              {question.is_active ? (
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="7" width="20" height="14" rx="2" />
                  <path d="M16 7V5a4 4 0 0 0-8 0v2" />
                </svg>
              ) : (
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="11" width="20" height="10" rx="2" />
                  <path d="M6 11V7a6 6 0 0 1 12 0v4" />
                </svg>
              )}
            </button>
            <button
              onClick={onEdit}
              title="Edit"
              className="grid h-8 w-8 place-items-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
            >
              <EditIcon width={14} height={14} />
            </button>
            <button
              onClick={onDelete}
              title="Delete"
              className="grid h-8 w-8 place-items-center rounded-lg border border-danger/30 text-danger hover:bg-danger/5"
            >
              <TrashIcon width={14} height={14} />
            </button>
          </div>
        </td>
      )}
    </tr>
  );
}

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "true", label: "Active only" },
  { value: "false", label: "Inactive only" },
];

export default function AssessmentQuestions() {
  const navigate = useNavigate();
  const { categoryId = "" } = useParams<{ categoryId: string }>();
  const { confirm } = useDialog();
  const scope = useAssessmentScope();
  const { templateId, template, rights, to } = scope;
  const crumbs = useAssessmentCrumbs(scope);
  const here = useHere();
  // Whoever opened this form gets sent back to it: the program step, or the template.
  const back = useReturnTo(scope.home);

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<"" | "true" | "false">("");
  // A template that does not say which kind it holds asks before the form opens.
  const [askingKind, setAskingKind] = useState(false);

  function openQuestionForm(kind?: QuestionKind) {
    const suffix = kind ? `?kind=${kind}` : "";
    navigate(to(`/categories/${categoryId}/questions/new${suffix}`), { state: here });
  }

  function startNewQuestion() {
    if (template?.question_kind) openQuestionForm();
    else setAskingKind(true);
  }

  const { data: category } = useGetCategoryQuery(categoryId, { skip: !categoryId });
  const { data, isLoading, isError } = useListQuestionsQuery(
    {
      templateId: templateId ?? "",
      categoryId,
      limit: 200,
      isActive: activeFilter === "" ? undefined : activeFilter === "true",
      search: search || undefined,
    },
    { skip: !templateId }
  );

  const [deleteQuestion] = useDeleteQuestionMutation();
  const [updateQuestion] = useUpdateQuestionMutation();
  const [reorderQuestions] = useReorderQuestionsMutation();

  // Memoise so an undefined response does not hand a fresh [] to the effect on
  // every render (which would loop setOrdered endlessly).
  const questions = useMemo(() => data?.questions ?? [], [data]);
  const [ordered, setOrdered] = useState<AssessmentQuestion[]>([]);
  useEffect(() => { setOrdered(questions); }, [questions]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !templateId) return;

    const prev = ordered;
    const oldIdx = ordered.findIndex((q) => q.id === active.id);
    const newIdx = ordered.findIndex((q) => q.id === over.id);
    const reordered = arrayMove(ordered, oldIdx, newIdx);
    setOrdered(reordered);

    try {
      await reorderQuestions({
        templateId,
        items: reordered.map((q, i) => ({ id: q.id, sortOrder: i })),
      }).unwrap();
      showSuccess("Order saved.");
    } catch (err) {
      showError(errMsg(err));
      setOrdered(prev);
    }
  }

  async function handleToggle(q: AssessmentQuestion) {
    try {
      await updateQuestion({ id: q.id, body: { isActive: !q.is_active } }).unwrap();
      showSuccess(`Question ${q.is_active ? "deactivated" : "activated"}.`);
    } catch (err) {
      showError(errMsg(err));
    }
  }

  async function handleDelete(q: AssessmentQuestion) {
    const ok = await confirm({
      title: "Delete question?",
      message: `"${q.question_text.slice(0, 80)}..." will be permanently removed.`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await deleteQuestion(q.id).unwrap();
      showSuccess("Question deleted.");
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

  const editable = rights.editQuestions;
  const isDraggable = editable && !search && activeFilter === "";
  const isForm = template.question_kind === "input";

  if (isForm && category && templateId) {
    return (
      <div className="space-y-6">
        <div>
          <Breadcrumbs className="mb-2" items={[...crumbs, { label: category.name }]} />
          <h1 className="text-2xl font-bold text-gray-900">{category.name}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {template.name}. One form the farmer fills in, with a field for every detail.
          </p>
        </div>
        <CategoryFormBuilder
          templateId={templateId}
          category={category}
          editable={editable}
          reason={rights.questionsReason}
          onSaved={() => back.go()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <Breadcrumbs className="mb-2" items={[...crumbs, { label: category?.name ?? "Questions" }]} />
          <h1 className="text-2xl font-bold text-gray-900">
            {category ? category.name : "Questions"}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {template.name}
            {editable && (isDraggable ? ". Drag rows to reorder." : ". Clear filters to enable drag-drop reorder.")}
          </p>
        </div>

        {editable && (
          <div className="flex flex-wrap items-center gap-2 sm:flex-shrink-0">
            <button
              onClick={startNewQuestion}
              className="btn-primary flex items-center gap-2"
            >
              <PlusIcon width={16} height={16} />
              New Question
            </button>
          </div>
        )}
      </div>

      {rights.questionsReason && <ReasonNote>{rights.questionsReason}</ReasonNote>}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <SearchIcon
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            width={16}
            height={16}
          />
          <input
            type="text"
            className="input-field w-full pl-9 text-sm"
            placeholder="Search questions..."
            maxLength={100}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          value={activeFilter}
          onChange={(v) => setActiveFilter(v as "" | "true" | "false")}
          options={STATUS_OPTIONS}
          className="sm:w-44"
        />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader size="md" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center py-16 text-center">
            <p className="text-danger">Could not load questions.</p>
            <p className="mt-1 text-sm text-gray-500">
              Please check your connection and try again.
            </p>
          </div>
        ) : ordered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <p className="text-gray-500">No questions yet.</p>
            {editable && (
              <button
                onClick={startNewQuestion}
                className="mt-3 text-sm font-medium text-primary hover:underline"
              >
                Add the first question
              </button>
            )}
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={isDraggable ? handleDragEnd : undefined}
          >
            <SortableContext
              items={ordered.map((q) => q.id)}
              strategy={verticalListSortingStrategy}
            >
              <table className="w-full min-w-[760px] text-left">
                <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  <tr>
                    {editable && <th className="w-8 px-3 py-3" />}
                    <th className="px-3 py-3">Code</th>
                    <th className="px-4 py-3">Question</th>
                    <th className="px-4 py-3">Answer</th>
                    <th className="px-4 py-3">Status</th>
                    {editable && <th className="px-4 py-3">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {ordered.map((q) => (
                    <SortableRow
                      key={q.id}
                      question={q}
                      editable={editable}
                      draggable={isDraggable}
                      onEdit={() =>
                        navigate(to(`/categories/${categoryId}/questions/${q.id}/edit`), { state: here })
                      }
                      onToggle={() => handleToggle(q)}
                      onDelete={() => handleDelete(q)}
                    />
                  ))}
                </tbody>
              </table>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {askingKind && (
        <QuestionKindModal
          title="What kind of question?"
          subtitle="This decides how the farmer answers it and how it is scored."
          onPick={(kind) => {
            setAskingKind(false);
            openQuestionForm(kind);
          }}
          onClose={() => setAskingKind(false)}
        />
      )}
    </div>
  );
}
