import { useEffect, useState } from "react";
import {
  useListQuestionsQuery,
  useSaveCategoryFieldsMutation,
  type CategoryFieldBody,
} from "../store/endpoints/assessmentApi";
import { showSuccess, showError } from "../lib/toast";
import { errMsg } from "../lib/errMsg";
import { useDialog } from "../components/ui/DialogProvider";
import {
  ANSWER_EXTRA_OPTIONS,
  INPUT_TYPE_OPTIONS,
} from "../lib/questionTypes";
import { ReasonNote } from "../components/AssessmentTemplateUi";
import Loader from "../components/Loader";
import Select from "../components/ui/Select";
import { PlusIcon, TrashIcon } from "../components/icons";
import type { AnswerExtra, AssessmentCategory, QuestionType } from "../types";

// The same ceilings the server applies to each field.
const LIMITS = { code: 20, text: 500, option: 300 };

interface OptionRow {
  optionText: string;
  score: string;
}

interface FieldRow {
  // Missing while the field is still being added.
  id?: string;
  questionCode: string;
  questionText: string;
  questionType: QuestionType;
  maxScore: string;
  evidenceMode: AnswerExtra;
  commentMode: AnswerExtra;
  isActive: boolean;
  options: OptionRow[];
}

const BLANK_OPTIONS: OptionRow[] = [
  { optionText: "", score: "0" },
  { optionText: "", score: "1" },
];

function blankField(): FieldRow {
  return {
    questionCode: "",
    questionText: "",
    questionType: "text",
    maxScore: "3",
    evidenceMode: "off",
    commentMode: "off",
    isActive: true,
    options: BLANK_OPTIONS,
  };
}

/** One field of the form: what it is called, what it asks for and what comes with it. */
function FieldCard({
  field,
  index,
  editable,
  error,
  onChange,
  onRemove,
  onMove,
}: {
  field: FieldRow;
  index: number;
  editable: boolean;
  error: string | null;
  onChange: (patch: Partial<FieldRow>) => void;
  onRemove: () => void;
  onMove: (to: number) => void;
}) {
  const isChoice = field.questionType === "mcq";

  function setOption(at: number, patch: Partial<OptionRow>) {
    onChange({ options: field.options.map((o, i) => (i === at ? { ...o, ...patch } : o)) });
  }

  return (
    <div className="rounded-xl border border-gray-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="mt-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Input field {index + 1}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40"
            disabled={!editable || index === 0}
            onClick={() => onMove(index - 1)}
            aria-label="Move up"
          >
            Up
          </button>
          <button
            type="button"
            className="rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
            disabled={!editable}
            onClick={() => onMove(index + 1)}
            aria-label="Move down"
          >
            Down
          </button>
          <button
            type="button"
            className="grid h-8 w-8 place-items-center rounded-lg border border-danger/30 text-danger hover:bg-danger/5 disabled:opacity-40"
            disabled={!editable}
            onClick={onRemove}
            aria-label="Remove this field"
          >
            <TrashIcon width={15} height={15} />
          </button>
        </div>
      </div>

      <div className="mt-2 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">
            Label <span className="text-danger">*</span>
          </label>
          <input
            className={`input-field ${error ? "input-error" : ""}`}
            value={field.questionText}
            onChange={(e) => onChange({ questionText: e.target.value })}
            placeholder="e.g. Date of the training"
            maxLength={LIMITS.text}
            disabled={!editable}
          />
          {error && <p className="field-error">{error}</p>}
        </div>

        <div>
          <label className="label">Farmer fills in</label>
          <Select
            options={INPUT_TYPE_OPTIONS}
            value={field.questionType}
            onChange={(v) => onChange({ questionType: v as QuestionType })}
            disabled={!editable}
          />
        </div>

        <div>
          <label className="label">Highest score</label>
          <input
            type="number"
            min="1"
            max="100"
            step="1"
            className="input-field"
            value={field.maxScore}
            onChange={(e) => onChange({ maxScore: e.target.value })}
            disabled={!editable || isChoice}
          />
          <p className="mt-1 text-xs text-gray-500">
            {isChoice
              ? "Comes from the highest scoring answer."
              : "The most an admin can give this answer in review."}
          </p>
        </div>

        {isChoice && (
          <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3 sm:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
              Answers to choose from
            </p>
            {field.options.map((option, i) => (
              <div key={i} className="flex items-start gap-2">
                <input
                  className="input-field flex-1"
                  value={option.optionText}
                  onChange={(e) => setOption(i, { optionText: e.target.value })}
                  placeholder={`Answer ${i + 1}`}
                  maxLength={LIMITS.option}
                  disabled={!editable}
                />
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  className="input-field w-24"
                  value={option.score}
                  onChange={(e) => setOption(i, { score: e.target.value })}
                  aria-label={`Score for answer ${i + 1}`}
                  disabled={!editable}
                />
                <button
                  type="button"
                  className="mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-danger/30 text-danger hover:bg-danger/5 disabled:opacity-40"
                  disabled={!editable || field.options.length <= 2}
                  onClick={() => onChange({ options: field.options.filter((_, at) => at !== i) })}
                  aria-label={`Remove answer ${i + 1}`}
                >
                  <TrashIcon width={15} height={15} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn-secondary"
              disabled={!editable || field.options.length >= 20}
              onClick={() => onChange({ options: [...field.options, { optionText: "", score: "0" }] })}
            >
              Add answer
            </button>
          </div>
        )}

        <div>
          <label className="label">Evidence with the answer</label>
          <Select
            options={ANSWER_EXTRA_OPTIONS}
            value={field.evidenceMode}
            onChange={(v) => onChange({ evidenceMode: v as AnswerExtra })}
            disabled={!editable}
          />
        </div>

        <div>
          <label className="label">Description with the answer</label>
          <Select
            options={ANSWER_EXTRA_OPTIONS}
            value={field.commentMode}
            onChange={(v) => onChange({ commentMode: v as AnswerExtra })}
            disabled={!editable}
          />
        </div>

        <div>
          <label className="label">Field code</label>
          <input
            className="input-field font-mono"
            value={field.questionCode}
            onChange={(e) => onChange({ questionCode: e.target.value })}
            placeholder="Optional, e.g. tr1"
            maxLength={LIMITS.code}
            disabled={!editable}
          />
        </div>

        <div className="flex items-end gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={field.isActive}
            disabled={!editable}
            onClick={() => onChange({ isActive: !field.isActive })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              field.isActive ? "bg-primary" : "bg-gray-300"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                field.isActive ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
          <span className="pb-1 text-sm text-gray-700">
            {field.isActive ? "Shown in the form" : "Hidden from the form"}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * A category of an input based assessment is one form, so its fields are built
 * and saved together rather than one question at a time.
 */
export default function CategoryFormBuilder({
  templateId,
  category,
  editable,
  reason,
  onSaved,
}: {
  templateId: string;
  category: AssessmentCategory;
  editable: boolean;
  reason: string | null;
  // Back to where the form was opened from, so the next category or step is one click away.
  onSaved: () => void;
}) {
  const { confirm } = useDialog();
  const { data, isLoading } = useListQuestionsQuery(
    { templateId, categoryId: category.id, limit: 200 },
    { skip: !templateId }
  );
  const [saveFields, { isLoading: saving }] = useSaveCategoryFieldsMutation();

  const [fields, setFields] = useState<FieldRow[]>([]);
  const [errors, setErrors] = useState<Record<number, string | null>>({});

  useEffect(() => {
    if (!data) return;
    setFields(
      data.questions.map((q) => ({
        id: q.id,
        questionCode: q.question_code ?? "",
        questionText: q.question_text,
        questionType: q.question_type,
        maxScore: String(q.max_score),
        evidenceMode: q.evidence_mode,
        commentMode: q.comment_mode,
        isActive: q.is_active,
        options: q.options.length
          ? q.options.map((o) => ({ optionText: o.option_text, score: String(o.score) }))
          : BLANK_OPTIONS,
      }))
    );
  }, [data]);

  function patch(index: number, changes: Partial<FieldRow>) {
    setFields((rows) => rows.map((r, i) => (i === index ? { ...r, ...changes } : r)));
  }

  function move(from: number, to: number) {
    setFields((rows) => {
      if (to < 0 || to >= rows.length) return rows;
      const next = [...rows];
      const [row] = next.splice(from, 1);
      next.splice(to, 0, row);
      return next;
    });
  }

  async function remove(index: number) {
    const row = fields[index];
    if (row.id) {
      const ok = await confirm({
        title: "Remove this field?",
        message: `"${row.questionText}" goes off the form. Answers already given to it are kept but no longer counted.`,
        confirmLabel: "Remove field",
        tone: "danger",
      });
      if (!ok) return;
    }
    setFields((rows) => rows.filter((_, i) => i !== index));
  }

  function validate(): boolean {
    const next: Record<number, string | null> = {};
    fields.forEach((row, i) => {
      if (!row.questionText.trim()) {
        next[i] = "A label is required.";
        return;
      }
      if (row.questionType === "mcq") {
        const filled = row.options.filter((o) => o.optionText.trim());
        if (filled.length < 2) {
          next[i] = "A choice field needs at least two answers.";
          return;
        }
        if (filled.some((o) => !Number.isInteger(Number(o.score)) || Number(o.score) < 0)) {
          next[i] = "Each answer needs a whole score of 0 or more.";
          return;
        }
      } else {
        const score = Number(row.maxScore);
        if (!Number.isInteger(score) || score < 1 || score > 100) {
          next[i] = "The highest score must be a whole number between 1 and 100.";
          return;
        }
      }
      next[i] = null;
    });
    setErrors(next);
    return Object.values(next).every((v) => v === null);
  }

  async function handleSave() {
    if (!validate()) return;
    const body: CategoryFieldBody[] = fields.map((row) => ({
      ...(row.id ? { id: row.id } : {}),
      questionCode: row.questionCode.trim() || null,
      questionText: row.questionText.trim(),
      questionType: row.questionType,
      evidenceMode: row.evidenceMode,
      commentMode: row.commentMode,
      isActive: row.isActive,
      ...(row.questionType === "mcq"
        ? {
            options: row.options
              .filter((o) => o.optionText.trim())
              .map((o) => ({ optionText: o.optionText.trim(), score: Number(o.score) })),
          }
        : { maxScore: Number(row.maxScore) }),
    }));
    try {
      await saveFields({ templateId, categoryId: category.id, fields: body }).unwrap();
      showSuccess("Form saved.");
      onSaved();
    } catch (err) {
      showError(errMsg(err));
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader size="md" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-4 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-gray-900">{category.name} form</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              The farmer fills this whole form in one go. Add a field for every detail you want.
            </p>
          </div>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
            {fields.length} field{fields.length === 1 ? "" : "s"}
          </span>
        </div>

        {!editable && reason && <ReasonNote>{reason}</ReasonNote>}

        {fields.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 px-5 py-10 text-center text-sm text-gray-500">
            No fields yet. Add the first one below.
          </div>
        ) : (
          <div className="space-y-4">
            {fields.map((field, index) => (
              <FieldCard
                key={field.id ?? `new-${index}`}
                field={field}
                index={index}
                editable={editable}
                error={errors[index] ?? null}
                onChange={(changes) => patch(index, changes)}
                onRemove={() => void remove(index)}
                onMove={(to) => move(index, to)}
              />
            ))}
          </div>
        )}

        {editable && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              className="btn-secondary"
              disabled={fields.length >= 200}
              onClick={() => setFields((rows) => [...rows, blankField()])}
            >
              <PlusIcon width={18} height={18} />
              Add input field
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="btn-secondary" onClick={onSaved}>
                Cancel
              </button>
              <button className="btn-primary" disabled={saving} onClick={() => void handleSave()}>
                {saving ? "Saving..." : "Save form"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
