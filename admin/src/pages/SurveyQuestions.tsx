import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  useListSurveyCategoriesQuery,
  useCreateSurveyCategoryMutation,
  useUpdateSurveyCategoryMutation,
  useDeleteSurveyCategoryMutation,
  useListSurveyQuestionsQuery,
  useCreateSurveyQuestionMutation,
  useUpdateSurveyQuestionMutation,
  useDeleteSurveyQuestionMutation,
  useListScoringRulesQuery,
  useUpdateScoringRuleMutation,
  CATEGORY_LABEL,
  CATEGORY_STYLE,
  type SurveyQuestion,
  type SurveyCategoryItem,
  type ScoringRule,
} from "../store/endpoints/eligibilityApi";
import { errMsg } from "../lib/errMsg";
import { useLiveData } from "../lib/useLiveData";
import { showSuccess, showError } from "../lib/toast";
import { useDialog } from "../components/ui/DialogProvider";
import Select from "../components/ui/Select";
import Loader from "../components/Loader";
import { PlusIcon, EditIcon, TrashIcon } from "../components/icons";

type Tab = "questions" | "categories" | "bands";

export default function SurveyQuestions() {
  const [tab, setTab] = useState<Tab>("questions");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Survey Questions</h1>
        <p className="mt-1 text-sm text-gray-500">
          The categories and 0-3 scale questions asked in the eligibility survey,
          and the score bands that decide Gold, Silver, Bronze or Not Qualified.
        </p>
      </div>

      <div className="flex gap-1 border-b border-gray-300">
        <TabButton active={tab === "questions"} onClick={() => setTab("questions")}>
          Questions
        </TabButton>
        <TabButton active={tab === "categories"} onClick={() => setTab("categories")}>
          Categories
        </TabButton>
        <TabButton active={tab === "bands"} onClick={() => setTab("bands")}>
          Score bands
        </TabButton>
      </div>

      {tab === "questions" && <QuestionsTab />}
      {tab === "categories" && <CategoriesTab />}
      {tab === "bands" && <BandsTab />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
        active
          ? "border-primary text-primary"
          : "border-transparent text-gray-500 hover:text-gray-800"
      }`}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Questions (grouped by category)
// ---------------------------------------------------------------------------

function QuestionsTab() {
  const { confirm } = useDialog();
  const { data, isLoading, isError, error, refetch } = useListSurveyQuestionsQuery();
  const { data: catData } = useListSurveyCategoriesQuery();
  useLiveData(["survey_questions"], refetch);

  const [del] = useDeleteSurveyQuestionMutation();
  const [update] = useUpdateSurveyQuestionMutation();
  const [editing, setEditing] = useState<SurveyQuestion | null>(null);
  const [creating, setCreating] = useState(false);

  const questions = data?.questions ?? [];
  const categories = catData?.categories ?? [];
  const byCategory = useMemo(() => {
    return categories.map((c) => ({
      category: c,
      questions: questions.filter((q) => q.category_id === c.id),
    }));
  }, [categories, questions]);

  async function toggleActive(q: SurveyQuestion) {
    try {
      await update({ id: q.id, body: { isActive: !q.is_active } }).unwrap();
      showSuccess(q.is_active ? "Question deactivated." : "Question activated.");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  async function handleDelete(q: SurveyQuestion) {
    const ok = await confirm({
      title: "Delete this question?",
      message: "Answers already submitted keep their recorded history.",
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await del(q.id).unwrap();
      showSuccess("Question deleted.");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-500">
          {questions.length} question(s) across {categories.length} categories
          {data?.maxScore !== undefined && (
            <>
              {" "}
              · highest possible score{" "}
              <span className="font-semibold text-gray-700">{data.maxScore}</span>
            </>
          )}
        </p>
        <button
          onClick={() => setCreating(true)}
          disabled={categories.length === 0}
          className="btn-primary self-start disabled:opacity-60"
        >
          <PlusIcon width={18} height={18} />
          New question
        </button>
      </div>

      {isLoading ? (
        <Loader message="Loading questions..." />
      ) : isError ? (
        <div className="card px-5 py-16 text-center text-sm text-gray-500">
          {errMsg(error)}
        </div>
      ) : categories.length === 0 ? (
        <div className="card px-5 py-16 text-center text-sm text-gray-500">
          Add a category first, then add questions to it.
        </div>
      ) : (
        <div className="space-y-5">
          {byCategory.map(({ category, questions: qs }) => (
            <div key={category.id} className="card overflow-hidden">
              <div className="border-b border-gray-300 bg-gray-100/60 px-5 py-3">
                <h2 className="text-sm font-bold text-gray-900">
                  {category.name}
                  <span className="ml-2 text-xs font-normal text-gray-500">
                    {qs.length} question(s)
                  </span>
                </h2>
              </div>
              {qs.length === 0 ? (
                <p className="px-5 py-6 text-sm text-gray-500">
                  No questions in this category yet.
                </p>
              ) : (
                <ul className="divide-y divide-gray-300/70">
                  {qs.map((q) => (
                    <li
                      key={q.id}
                      className="flex items-start gap-4 px-5 py-4"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900">
                          {q.question_text}
                          {!q.is_active && (
                            <span className="ml-2 rounded-full bg-gray-300/60 px-2 py-0.5 text-xs font-semibold text-gray-600">
                              Inactive
                            </span>
                          )}
                        </p>
                        {q.help_text && (
                          <p className="mt-0.5 text-sm text-gray-500">
                            {q.help_text}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-gray-400">
                          0-3 scale · weight {q.weight}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          onClick={() => toggleActive(q)}
                          className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                        >
                          {q.is_active ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          onClick={() => setEditing(q)}
                          className="grid h-8 w-8 place-items-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-primary"
                          aria-label="Edit question"
                        >
                          <EditIcon width={15} height={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(q)}
                          className="grid h-8 w-8 place-items-center rounded-lg text-gray-400 hover:bg-danger/5 hover:text-danger"
                          aria-label="Delete question"
                        >
                          <TrashIcon width={15} height={15} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <QuestionModal
          question={editing}
          categories={categories}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function QuestionModal({
  question,
  categories,
  onClose,
}: {
  question: SurveyQuestion | null;
  categories: SurveyCategoryItem[];
  onClose: () => void;
}) {
  const isEdit = Boolean(question);
  const [create] = useCreateSurveyQuestionMutation();
  const [update] = useUpdateSurveyQuestionMutation();

  const [categoryId, setCategoryId] = useState(
    question?.category_id ?? categories[0]?.id ?? ""
  );
  const [text, setText] = useState(question?.question_text ?? "");
  const [help, setHelp] = useState(question?.help_text ?? "");
  const [weight, setWeight] = useState(String(question?.weight ?? 1));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!categoryId) return setError("Choose a category.");
    if (text.trim().length < 3) return setError("Enter the question text.");
    const w = Number(weight);
    if (Number.isNaN(w) || w < 1) return setError("Weight must be at least 1.");
    setError(null);
    setSaving(true);
    try {
      const body = {
        categoryId,
        questionText: text.trim(),
        helpText: help.trim() || null,
        weight: w,
      };
      if (isEdit && question) {
        await update({ id: question.id, body }).unwrap();
        showSuccess("Question updated.");
      } else {
        await create(body).unwrap();
        showSuccess("Question created.");
      }
      onClose();
    } catch (err) {
      showError(errMsg(err));
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        className="modal-panel card w-full max-w-lg p-6 sm:p-7"
        onClick={(e) => e.stopPropagation()}
        noValidate
      >
        <h2 className="text-lg font-bold text-gray-900">
          {isEdit ? "Edit question" : "New question"}
        </h2>

        <div className="mt-5 space-y-4">
          <div>
            <label htmlFor="qcat" className="label">
              Category <span className="text-danger">*</span>
            </label>
            <Select
              id="qcat"
              value={categoryId}
              onChange={setCategoryId}
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
              placeholder="Choose a category"
            />
          </div>
          <div>
            <label htmlFor="qtext" className="label">
              Question <span className="text-danger">*</span>
            </label>
            <textarea
              id="qtext"
              rows={2}
              className="input-field"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="To what extent do you..."
            />
          </div>
          <div>
            <label htmlFor="qhelp" className="label">
              Help text
            </label>
            <input
              id="qhelp"
              className="input-field"
              value={help}
              onChange={(e) => setHelp(e.target.value)}
              placeholder="Optional hint shown under the question"
            />
          </div>
          <div>
            <label htmlFor="qweight" className="label">
              Weight
            </label>
            <input
              id="qweight"
              type="number"
              min="1"
              className="input-field w-32"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
            <p className="mt-1.5 text-xs text-gray-500">
              Score = answer (0-3) × weight. Weight 1 means the question is worth
              up to 3 points.
            </p>
          </div>
          {error && <p className="field-error">{error}</p>}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-secondary py-2.5">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn-primary py-2.5">
            {saving ? "Saving..." : isEdit ? "Save changes" : "Create question"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

function CategoriesTab() {
  const { confirm } = useDialog();
  const { data, isLoading, isError, error, refetch } = useListSurveyCategoriesQuery();
  useLiveData(["survey_questions"], refetch);
  const [del] = useDeleteSurveyCategoryMutation();
  const [update] = useUpdateSurveyCategoryMutation();
  const [editing, setEditing] = useState<SurveyCategoryItem | null>(null);
  const [creating, setCreating] = useState(false);

  const categories = data?.categories ?? [];

  async function toggleActive(c: SurveyCategoryItem) {
    try {
      await update({ id: c.id, body: { isActive: !c.is_active } }).unwrap();
      showSuccess(c.is_active ? "Category deactivated." : "Category activated.");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  async function handleDelete(c: SurveyCategoryItem) {
    const ok = await confirm({
      title: "Delete this category?",
      message: "Its questions will be deleted too. This cannot be undone.",
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await del(c.id).unwrap();
      showSuccess("Category deleted.");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{categories.length} categor(ies)</p>
        <button onClick={() => setCreating(true)} className="btn-primary">
          <PlusIcon width={18} height={18} />
          New category
        </button>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <Loader message="Loading categories..." />
        ) : isError ? (
          <div className="px-5 py-16 text-center text-sm text-gray-500">
            {errMsg(error)}
          </div>
        ) : categories.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-gray-500">
            No categories yet. Add the first one.
          </div>
        ) : (
          <ul className="divide-y divide-gray-300/70">
            {categories.map((c) => (
              <li key={c.id} className="flex items-start gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900">
                    {c.name}
                    {!c.is_active && (
                      <span className="ml-2 rounded-full bg-gray-300/60 px-2 py-0.5 text-xs font-semibold text-gray-600">
                        Inactive
                      </span>
                    )}
                    <span className="ml-2 text-xs font-normal text-gray-500">
                      {c.question_count ?? 0} question(s)
                    </span>
                  </p>
                  {c.description && (
                    <p className="mt-0.5 text-sm text-gray-500">{c.description}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => toggleActive(c)}
                    className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                  >
                    {c.is_active ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    onClick={() => setEditing(c)}
                    className="grid h-8 w-8 place-items-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-primary"
                    aria-label="Edit category"
                  >
                    <EditIcon width={15} height={15} />
                  </button>
                  <button
                    onClick={() => handleDelete(c)}
                    className="grid h-8 w-8 place-items-center rounded-lg text-gray-400 hover:bg-danger/5 hover:text-danger"
                    aria-label="Delete category"
                  >
                    <TrashIcon width={15} height={15} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {(creating || editing) && (
        <CategoryModal
          category={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function CategoryModal({
  category,
  onClose,
}: {
  category: SurveyCategoryItem | null;
  onClose: () => void;
}) {
  const isEdit = Boolean(category);
  const [create] = useCreateSurveyCategoryMutation();
  const [update] = useUpdateSurveyCategoryMutation();
  const [name, setName] = useState(category?.name ?? "");
  const [description, setDescription] = useState(category?.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) return setError("Enter a category name.");
    setError(null);
    setSaving(true);
    try {
      const body = { name: name.trim(), description: description.trim() || null };
      if (isEdit && category) {
        await update({ id: category.id, body }).unwrap();
        showSuccess("Category updated.");
      } else {
        await create(body).unwrap();
        showSuccess("Category created.");
      }
      onClose();
    } catch (err) {
      showError(errMsg(err));
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        className="modal-panel card w-full max-w-lg p-6 sm:p-7"
        onClick={(e) => e.stopPropagation()}
        noValidate
      >
        <h2 className="text-lg font-bold text-gray-900">
          {isEdit ? "Edit category" : "New category"}
        </h2>
        <div className="mt-5 space-y-4">
          <div>
            <label htmlFor="cname" className="label">
              Name <span className="text-danger">*</span>
            </label>
            <input
              id="cname"
              className="input-field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Soil Health"
            />
          </div>
          <div>
            <label htmlFor="cdesc" className="label">
              Description
            </label>
            <textarea
              id="cdesc"
              rows={2}
              className="input-field"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Shown under the category heading in the survey"
            />
          </div>
          {error && <p className="field-error">{error}</p>}
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-secondary py-2.5">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn-primary py-2.5">
            {saving ? "Saving..." : isEdit ? "Save changes" : "Create category"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Score bands
// ---------------------------------------------------------------------------

function BandsTab() {
  const { data, isLoading, isError, error, refetch } = useListScoringRulesQuery();
  useLiveData(["survey_questions"], refetch);

  return (
    <>
      <p className="text-sm text-gray-500">
        A producer&apos;s total score decides their band. The highest possible
        score right now is{" "}
        <span className="font-semibold text-gray-700">{data?.maxScore ?? 0}</span>
        , so make sure the bands cover that range.
      </p>
      <div className="card overflow-hidden">
        {isLoading ? (
          <Loader message="Loading bands..." />
        ) : isError ? (
          <div className="px-5 py-16 text-center text-sm text-gray-500">
            {errMsg(error)}
          </div>
        ) : (
          <ul className="divide-y divide-gray-300/70">
            {(data?.rules ?? []).map((r) => (
              <BandRow key={r.id} rule={r} />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function BandRow({ rule }: { rule: ScoringRule }) {
  const [update, { isLoading: saving }] = useUpdateScoringRuleMutation();
  const [min, setMin] = useState(String(rule.min_score));
  const [max, setMax] = useState(String(rule.max_score));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMin(String(rule.min_score));
    setMax(String(rule.max_score));
  }, [rule.min_score, rule.max_score]);

  const dirty = Number(min) !== rule.min_score || Number(max) !== rule.max_score;

  async function save() {
    const minN = Number(min);
    const maxN = Number(max);
    if (min.trim() === "" || max.trim() === "" || Number.isNaN(minN) || Number.isNaN(maxN)) {
      setError("Enter numbers for both ends of the range.");
      return;
    }
    if (minN < 0 || maxN < 0) {
      setError("Scores cannot be negative.");
      return;
    }
    if (minN > maxN) {
      setError("The minimum cannot be higher than the maximum.");
      return;
    }
    setError(null);
    try {
      await update({ id: rule.id, body: { minScore: minN, maxScore: maxN } }).unwrap();
      showSuccess(`${CATEGORY_LABEL[rule.category]} band updated.`);
    } catch (err) {
      showError(errMsg(err));
    }
  }

  return (
    <li className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center">
      <span
        className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-bold ${CATEGORY_STYLE[rule.category]}`}
      >
        {CATEGORY_LABEL[rule.category]}
      </span>
      <div className="flex flex-1 flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500">From</label>
          <input
            type="number"
            className={`input-field w-24 py-2 ${error ? "input-error" : ""}`}
            value={min}
            onChange={(e) => setMin(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500">To</label>
          <input
            type="number"
            className={`input-field w-24 py-2 ${error ? "input-error" : ""}`}
            value={max}
            onChange={(e) => setMax(e.target.value)}
          />
        </div>
        {error && <p className="field-error mt-0">{error}</p>}
      </div>
      <button
        onClick={save}
        disabled={!dirty || saving}
        className="btn-secondary shrink-0 py-2.5 text-sm"
      >
        {saving ? "Saving..." : "Save"}
      </button>
    </li>
  );
}
