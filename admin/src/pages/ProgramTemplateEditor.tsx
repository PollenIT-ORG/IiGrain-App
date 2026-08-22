import { useMemo, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  useGetPasTemplateQuery,
  useCreatePasCategoryMutation,
  useUpdatePasCategoryMutation,
  useDeletePasCategoryMutation,
  useCreatePasQuestionMutation,
  useUpdatePasQuestionMutation,
  useDeletePasQuestionMutation,
  useUpdatePasScoringRuleMutation,
  CATEGORY_LABEL,
  SCALE_LABELS,
  type Category,
  type TemplateCategory,
  type TemplateQuestion,
  type ScoringRule,
} from "../store/endpoints/programAdminSurveyApi";
import { errMsg } from "../lib/errMsg";
import { useAuth } from "../store/useAuth";
import { useLiveData } from "../lib/useLiveData";
import { showSuccess, showError } from "../lib/toast";
import { useDialog } from "../components/ui/DialogProvider";
import Select from "../components/ui/Select";
import Loader from "../components/Loader";
import { CategoryIcon, CATEGORY_ICON_KEYS } from "./survey/SurveyIcons";
import { PlusIcon, EditIcon, TrashIcon, ChevronLeftIcon } from "../components/icons";

const BAND_ORDER: Category[] = ["gold", "silver", "bronze", "not_qualified"];

export default function ProgramTemplateEditor() {
  const navigate = useNavigate();
  const { id = "" } = useParams();
  return <SurveyEditor id={id} onBack={() => navigate("/surveys")} />;
}

/**
 * The whole survey - its categories, questions and score bands.
 *
 * It is the page behind /surveys/surveys/:id, and the same component is opened
 * over the Programs list when a survey is created for a program, so setting a
 * program up never means leaving it. Leave `onBack` out when it is embedded:
 * whatever is showing it provides its own way back.
 */
export function SurveyEditor({
  id,
  onBack,
}: {
  id: string;
  onBack?: () => void;
}) {
  const { user } = useAuth();
  const isPlatformAdmin =
    user?.role === "admin" || user?.role === "super_admin";
  const { data, isLoading, isError, error, refetch } = useGetPasTemplateQuery(id, {
    skip: !id,
  });
  useLiveData(["program_admin_survey"], refetch);

  if (isLoading) return <Loader variant="fullPage" message="Loading survey..." />;
  if (isError || !data) {
    return (
      <div className="space-y-4">
        {onBack && <BackBtn onClick={onBack} />}
        <div className="card px-5 py-16 text-center text-sm text-gray-500">
          {errMsg(error) || "Survey not found."}
        </div>
      </div>
    );
  }

  const { template, categories, questions, scoringRules } = data;
  // The global template is the shared master: platform admins maintain it,
  // program administrators must copy it first.
  const readOnly = template.is_global && !isPlatformAdmin;

  return (
    <div className="space-y-5">
      {onBack && <BackBtn onClick={onBack} />}

      {/* Embedded, the sheet's own header already names the survey. */}
      {(onBack || template.is_global) && (
        <div className="flex flex-wrap items-center gap-3">
          {onBack && (
            <h1 className="text-2xl font-bold text-gray-900">{template.name}</h1>
          )}
          {template.is_global && (
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
              Global
            </span>
          )}
        </div>
      )}
      {template.description && (
        <p className="-mt-3 text-sm text-gray-500">{template.description}</p>
      )}

      {readOnly ? (
        <div className="rounded-lg border border-info/30 bg-info/5 p-4 text-sm text-gray-700">
          This is the shared Global survey and cannot be edited. Copy it (or
          start blank) from the Surveys tab to make your own editable version.
        </div>
      ) : (
        template.is_global && (
          <div className="rounded-lg border border-accent/30 bg-accent/5 p-4 text-sm text-gray-700">
            You are editing the shared <strong>Global</strong> survey. Changes
            here affect every program administrator who uses it as their starting
            point.
          </div>
        )
      )}

      <CategoriesCard
        templateId={id}
        categories={categories}
        readOnly={readOnly}
      />
      <QuestionsCard
        templateId={id}
        categories={categories}
        questions={questions}
        readOnly={readOnly}
      />
      <ThresholdsCard
        templateId={id}
        rules={scoringRules}
        readOnly={readOnly}
      />
    </div>
  );
}

// -------------------------------- Categories -------------------------------

function CategoriesCard({
  templateId,
  categories,
  readOnly,
}: {
  templateId: string;
  categories: TemplateCategory[];
  readOnly: boolean;
}) {
  const [createCat] = useCreatePasCategoryMutation();
  const [updateCat] = useUpdatePasCategoryMutation();
  const [deleteCat] = useDeletePasCategoryMutation();
  const { confirm } = useDialog();
  const [editing, setEditing] = useState<TemplateCategory | null>(null);
  const [creating, setCreating] = useState(false);

  async function handleDelete(c: TemplateCategory) {
    const ok = await confirm({
      title: "Delete this category?",
      message: `"${c.name}" and all its questions will be removed.`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await deleteCat({ id: c.id, templateId }).unwrap();
      showSuccess("Category deleted.");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-gray-900">
          Categories{" "}
          <span className="font-normal text-gray-400">({categories.length})</span>
        </p>
        {!readOnly && (
          <button className="btn-secondary" onClick={() => setCreating(true)}>
            <PlusIcon width={16} height={16} />
            Add category
          </button>
        )}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {categories.map((c) => (
          <div
            key={c.id}
            className="flex items-center gap-3 rounded-lg border border-gray-300 p-3"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <CategoryIcon icon={c.icon} width={18} height={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-gray-900">
                {c.name}
                {!c.is_active && (
                  <span className="ml-2 text-xs font-normal text-gray-400">
                    (inactive)
                  </span>
                )}
              </p>
              <p className="text-xs text-gray-500">
                {c.question_count ?? 0} questions
              </p>
            </div>
            {!readOnly && (
              <div className="flex shrink-0 gap-1">
                <button
                  onClick={() => setEditing(c)}
                  className="grid h-8 w-8 place-items-center rounded-lg text-gray-500 hover:bg-gray-100"
                  aria-label="Edit"
                >
                  <EditIcon width={15} height={15} />
                </button>
                <button
                  onClick={() => handleDelete(c)}
                  className="grid h-8 w-8 place-items-center rounded-lg text-gray-400 hover:bg-danger/5 hover:text-danger"
                  aria-label="Delete"
                >
                  <TrashIcon width={15} height={15} />
                </button>
              </div>
            )}
          </div>
        ))}
        {categories.length === 0 && (
          <p className="col-span-full py-6 text-center text-sm text-gray-500">
            No categories yet.
          </p>
        )}
      </div>

      {(creating || editing) && (
        <CategoryModal
          templateId={templateId}
          category={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          save={async (body) => {
            if (editing) await updateCat({ id: editing.id, templateId, body }).unwrap();
            else await createCat({ templateId, body }).unwrap();
          }}
        />
      )}
    </div>
  );
}

function CategoryModal({
  templateId: _templateId,
  category,
  onClose,
  save,
}: {
  templateId: string;
  category: TemplateCategory | null;
  onClose: () => void;
  save: (body: {
    name: string;
    description: string | null;
    icon: string | null;
    isActive: boolean;
  }) => Promise<void>;
}) {
  const [name, setName] = useState(category?.name ?? "");
  const [description, setDescription] = useState(category?.description ?? "");
  const [icon, setIcon] = useState(category?.icon ?? CATEGORY_ICON_KEYS[0]);
  const [isActive, setIsActive] = useState(category?.is_active ?? true);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return showError("Category name is required.");
    setBusy(true);
    try {
      await save({
        name: name.trim(),
        description: description.trim() || null,
        icon,
        isActive,
      });
      showSuccess(category ? "Category updated." : "Category added.");
      onClose();
    } catch (err) {
      showError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell title={category ? "Edit category" : "Add category"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4 p-5">
        <div>
          <label className="label">Category name</label>
          <input
            className="input-field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={150}
            autoFocus
          />
        </div>
        <div>
          <label className="label">Description (optional)</label>
          <input
            className="input-field"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
          />
        </div>
        <div>
          <label className="label">Icon</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_ICON_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setIcon(k)}
                className={`grid h-10 w-10 place-items-center rounded-lg border transition-colors ${
                  icon === k
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-gray-300 text-gray-500 hover:bg-gray-100"
                }`}
              >
                <CategoryIcon icon={k} width={18} height={18} />
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Active (shown in the survey)
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// -------------------------------- Questions --------------------------------

function QuestionsCard({
  templateId,
  categories,
  questions,
  readOnly,
}: {
  templateId: string;
  categories: TemplateCategory[];
  questions: TemplateQuestion[];
  readOnly: boolean;
}) {
  const [deleteQ] = useDeletePasQuestionMutation();
  const { confirm } = useDialog();
  const [editing, setEditing] = useState<TemplateQuestion | null>(null);
  const [creating, setCreating] = useState(false);

  const catName = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of categories) m.set(c.id, c.name);
    return m;
  }, [categories]);

  const byCat = useMemo(() => {
    const m = new Map<string, TemplateQuestion[]>();
    for (const q of questions) {
      const k = q.category_id ?? "none";
      const list = m.get(k) ?? [];
      list.push(q);
      m.set(k, list);
    }
    return m;
  }, [questions]);

  async function handleDelete(q: TemplateQuestion) {
    const ok = await confirm({
      title: "Delete this question?",
      message: "This question will be removed from the template.",
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await deleteQ({ id: q.id, templateId }).unwrap();
      showSuccess("Question deleted.");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-gray-900">
          Questions{" "}
          <span className="font-normal text-gray-400">({questions.length})</span>
        </p>
        {!readOnly && (
          <button
            className="btn-secondary"
            onClick={() => setCreating(true)}
            disabled={categories.length === 0}
            title={categories.length === 0 ? "Add a category first" : undefined}
          >
            <PlusIcon width={16} height={16} />
            Add question
          </button>
        )}
      </div>

      <div className="mt-4 space-y-5">
        {categories.map((c) => {
          const qs = byCat.get(c.id) ?? [];
          if (!qs.length) return null;
          return (
            <div key={c.id}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                {c.name}
              </p>
              <div className="divide-y divide-gray-200 rounded-lg border border-gray-300">
                {qs.map((q, i) => (
                  <div key={q.id} className="flex items-start gap-3 p-3">
                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-gray-100 text-xs font-bold text-gray-500">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {q.question_text}
                        {!q.is_active && (
                          <span className="ml-2 text-xs font-normal text-gray-400">
                            (inactive)
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        Weight {q.weight} &middot;{" "}
                        {q.options
                          .map((o, idx) => o?.trim() || SCALE_LABELS[idx])
                          .join(" / ")}
                      </p>
                    </div>
                    {!readOnly && (
                      <div className="flex shrink-0 gap-1">
                        <button
                          onClick={() => setEditing(q)}
                          className="grid h-8 w-8 place-items-center rounded-lg text-gray-500 hover:bg-gray-100"
                          aria-label="Edit"
                        >
                          <EditIcon width={15} height={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(q)}
                          className="grid h-8 w-8 place-items-center rounded-lg text-gray-400 hover:bg-danger/5 hover:text-danger"
                          aria-label="Delete"
                        >
                          <TrashIcon width={15} height={15} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {questions.length === 0 && (
          <p className="py-6 text-center text-sm text-gray-500">
            No questions yet.
          </p>
        )}
      </div>

      {(creating || editing) && (
        <QuestionModal
          templateId={templateId}
          categories={categories}
          question={editing}
          catName={catName}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function QuestionModal({
  templateId,
  categories,
  question,
  onClose,
}: {
  templateId: string;
  categories: TemplateCategory[];
  question: TemplateQuestion | null;
  catName: Map<string, string>;
  onClose: () => void;
}) {
  const [create] = useCreatePasQuestionMutation();
  const [update] = useUpdatePasQuestionMutation();
  const activeCats = categories.filter((c) => c.is_active || c.id === question?.category_id);

  const [categoryId, setCategoryId] = useState(
    question?.category_id ?? activeCats[0]?.id ?? ""
  );
  const [text, setText] = useState(question?.question_text ?? "");
  const [help, setHelp] = useState(question?.help_text ?? "");
  const [weight, setWeight] = useState(String(question?.weight ?? 1));
  const [isActive, setIsActive] = useState(question?.is_active ?? true);
  const [options, setOptions] = useState<string[]>(() => {
    const o = question?.options ?? [];
    return [0, 1, 2, 3].map((i) => o[i] ?? "");
  });
  const [busy, setBusy] = useState(false);

  function setOption(i: number, v: string) {
    setOptions((prev) => prev.map((x, idx) => (idx === i ? v : x)));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!categoryId) return showError("Choose a category.");
    if (!text.trim()) return showError("Question text is required.");
    const w = Number(weight);
    if (Number.isNaN(w) || w < 1) return showError("Weight must be at least 1.");
    const body = {
      categoryId,
      questionText: text.trim(),
      helpText: help.trim() || null,
      weight: w,
      isActive,
      options: options.map((o) => o.trim() || null),
    };
    setBusy(true);
    try {
      if (question) await update({ id: question.id, templateId, body }).unwrap();
      else await create({ templateId, body }).unwrap();
      showSuccess(question ? "Question updated." : "Question added.");
      onClose();
    } catch (err) {
      showError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell title={question ? "Edit question" : "Add question"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Category</label>
            <Select
              value={categoryId}
              onChange={setCategoryId}
              options={activeCats.map((c) => ({ value: c.id, label: c.name }))}
              placeholder="Choose a category"
            />
          </div>
          <div>
            <label className="label">Weight</label>
            <input
              type="number"
              min={1}
              max={100}
              className="input-field"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="label">Question</label>
          <textarea
            rows={2}
            className="input-field resize-none"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={2000}
            autoFocus
          />
        </div>
        <div>
          <label className="label">Help text (optional)</label>
          <input
            className="input-field"
            value={help}
            onChange={(e) => setHelp(e.target.value)}
            maxLength={2000}
          />
        </div>
        <div>
          <label className="label">Answer options (0 to 3 scale)</label>
          <div className="space-y-2">
            {options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-gray-100 text-sm font-bold text-gray-600">
                  {i}
                </span>
                <input
                  className="input-field"
                  value={o}
                  onChange={(e) => setOption(i, e.target.value)}
                  placeholder={SCALE_LABELS[i]}
                  maxLength={200}
                />
              </div>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-gray-500">
            Leave blank to use the default label ({SCALE_LABELS.join(" / ")}).
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Active (shown in the survey)
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// -------------------------------- Thresholds -------------------------------

function ThresholdsCard({
  templateId,
  rules,
  readOnly,
}: {
  templateId: string;
  rules: ScoringRule[];
  readOnly: boolean;
}) {
  const [updateRule] = useUpdatePasScoringRuleMutation();
  const ordered = BAND_ORDER.map((b) => rules.find((r) => r.category === b)).filter(
    (r): r is ScoringRule => Boolean(r)
  );

  return (
    <div className="card p-5">
      <p className="text-sm font-bold text-gray-900">
        Score bands{" "}
        <span className="font-normal text-gray-400">
          (percentage of the maximum score)
        </span>
      </p>
      <div className="mt-4 space-y-2">
        {ordered.map((r) => (
          <ThresholdRow
            key={r.id}
            rule={r}
            readOnly={readOnly}
            save={(minScore, maxScore) =>
              updateRule({
                templateId,
                ruleId: r.id,
                body: { minScore, maxScore },
              }).unwrap()
            }
          />
        ))}
      </div>
    </div>
  );
}

function ThresholdRow({
  rule,
  readOnly,
  save,
}: {
  rule: ScoringRule;
  readOnly: boolean;
  save: (min: number, max: number) => Promise<unknown>;
}) {
  const [min, setMin] = useState(String(rule.min_score));
  const [max, setMax] = useState(String(rule.max_score));
  const [busy, setBusy] = useState(false);
  const dirty = min !== String(rule.min_score) || max !== String(rule.max_score);

  async function handleSave() {
    const lo = Number(min);
    const hi = Number(max);
    if (Number.isNaN(lo) || Number.isNaN(hi) || lo > hi)
      return showError("Enter a valid range (min cannot exceed max).");
    setBusy(true);
    try {
      await save(lo, hi);
      showSuccess("Score band updated.");
    } catch (err) {
      showError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-300 p-3">
      <span className="w-28 text-sm font-semibold text-gray-900">
        {CATEGORY_LABEL[rule.category as Category] ?? rule.category}
      </span>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min={0}
          max={100}
          className="input-field w-20"
          value={min}
          onChange={(e) => setMin(e.target.value)}
          disabled={readOnly}
        />
        <span className="text-gray-400">to</span>
        <input
          type="number"
          min={0}
          max={100}
          className="input-field w-20"
          value={max}
          onChange={(e) => setMax(e.target.value)}
          disabled={readOnly}
        />
        <span className="text-sm text-gray-500">%</span>
      </div>
      {!readOnly && dirty && (
        <button className="btn-primary ml-auto" onClick={handleSave} disabled={busy}>
          {busy ? "Saving..." : "Save"}
        </button>
      )}
    </div>
  );
}

// ---------------------------------- shared ---------------------------------

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-card-hover"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-300 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-gray-500 hover:bg-gray-100"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-primary"
    >
      <ChevronLeftIcon width={16} height={16} />
      Back to surveys
    </button>
  );
}
