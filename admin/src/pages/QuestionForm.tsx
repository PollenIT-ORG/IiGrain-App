import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  useCreateQuestionMutation,
  useUpdateQuestionMutation,
  useGetQuestionQuery,
  useListCategoriesQuery,
} from "../store/endpoints/assessmentApi";
import { showSuccess, showError } from "../lib/toast";
import { errMsg } from "../lib/errMsg";
import { required, requiredSelect, isClean } from "../lib/validation";
import { useAssessmentCrumbs, useAssessmentScope } from "../lib/assessmentScope";
import { useReturnTo } from "../lib/returnTo";
import { ReasonNote } from "../components/AssessmentTemplateUi";
import Loader from "../components/Loader";
import Breadcrumbs from "../components/ui/Breadcrumbs";
import Select from "../components/ui/Select";
import { TrashIcon } from "../components/icons";
import {
  ANSWER_EXTRA_OPTIONS,
  INPUT_TYPE_OPTIONS,
  QUESTION_TYPE_LABELS,
  typeForKind,
} from "../lib/questionTypes";
import type { AnswerExtra, QuestionKind, QuestionType } from "../types";

// The same ceilings the server applies to each field.
const LIMITS = { code: 20, text: 500, guidance: 1000, score: 500, option: 300 };

interface OptionRow {
  optionText: string;
  score: string;
}

const BLANK_OPTIONS: OptionRow[] = [
  { optionText: "", score: "0" },
  { optionText: "", score: "1" },
];

function tooLong(value: string, max: number, label: string): string | null {
  return value.trim().length > max ? `${label} must be ${max} characters or fewer.` : null;
}

function ScoreField({
  label,
  value,
  onChange,
  placeholder,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string | null;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
      </label>
      <textarea
        className={`input-field resize-y text-sm ${error ? "input-error" : ""}`}
        rows={2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={LIMITS.score}
      />
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}

export default function QuestionForm() {
  const { categoryId, id } = useParams<{ categoryId: string; id: string }>();
  const [params] = useSearchParams();
  // A template with no kind of its own asks before the form opens, and says so here.
  const asked = params.get("kind");
  const askedKind: QuestionKind | null = asked === "mcq" || asked === "input" ? asked : null;
  const isEdit = Boolean(id);
  const scope = useAssessmentScope();
  const { templateId, template, rights, to, home } = scope;
  const back = useReturnTo(categoryId ? to(`/categories/${categoryId}/questions`) : home);
  const crumbs = useAssessmentCrumbs(scope);

  const { data: existing, isLoading: loadingExisting } = useGetQuestionQuery(
    id!,
    { skip: !isEdit }
  );
  const { data: categories = [] } = useListCategoriesQuery(templateId ?? "", { skip: !templateId });

  const [createQuestion, { isLoading: creating }] = useCreateQuestionMutation();
  const [updateQuestion, { isLoading: updating }] = useUpdateQuestionMutation();

  const [selectedCategoryId, setSelectedCategoryId] = useState(categoryId ?? "");
  const [questionCode, setQuestionCode] = useState("");
  const [questionText, setQuestionText] = useState("");
  const [questionType, setQuestionType] = useState<QuestionType>(
    askedKind ? typeForKind(askedKind) : "text"
  );
  const [maxScore, setMaxScore] = useState("3");
  const [evidenceMode, setEvidenceMode] = useState<AnswerExtra>("off");
  const [commentMode, setCommentMode] = useState<AnswerExtra>("off");
  const [options, setOptions] = useState<OptionRow[]>(BLANK_OPTIONS);
  const [guidanceNote, setGuidanceNote] = useState("");
  const [score0, setScore0] = useState("");
  const [score1, setScore1] = useState("");
  const [score2, setScore2] = useState("");
  const [score3, setScore3] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (isEdit || askedKind || !template?.question_kind) return;
    setQuestionType(typeForKind(template.question_kind));
  }, [isEdit, askedKind, template?.question_kind]);

  useEffect(() => {
    if (existing) {
      setSelectedCategoryId(existing.category_id);
      setQuestionCode(existing.question_code ?? "");
      setQuestionText(existing.question_text);
      setQuestionType(existing.question_type);
      setMaxScore(String(existing.max_score));
      setEvidenceMode(existing.evidence_mode);
      setCommentMode(existing.comment_mode);
      setOptions(
        existing.options.length
          ? existing.options.map((o) => ({ optionText: o.option_text, score: String(o.score) }))
          : BLANK_OPTIONS
      );
      setGuidanceNote(existing.guidance_note ?? "");
      setScore0(existing.score0_description ?? "");
      setScore1(existing.score1_description ?? "");
      setScore2(existing.score2_description ?? "");
      setScore3(existing.score3_description ?? "");
      setIsActive(existing.is_active);
    }
  }, [existing]);

  const isSaving = creating || updating;

  const categoryOptions = [
    { value: "", label: "Select a category" },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ];

  const isMcq = questionType === "mcq";
  const isScored = questionType === "scored";
  // Everything the farmer fills in is scored by an admin, out of this top score.
  const takesMaxScore = !isMcq && !isScored;
  // A form picks what each field asks for; a multiple choice template does not.
  const templateKind = template?.question_kind ?? askedKind;
  const picksField = !isScored && templateKind !== "mcq";

  function setOption(index: number, patch: Partial<OptionRow>) {
    setOptions((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function optionsError(): string | null {
    if (!isMcq) return null;
    const filled = options.filter((o) => o.optionText.trim());
    if (filled.length < 2) return "Add at least two answers to choose from.";
    for (const o of filled) {
      if (o.optionText.trim().length > LIMITS.option) {
        return `An answer must be ${LIMITS.option} characters or fewer.`;
      }
      const score = Number(o.score);
      if (o.score.trim() === "" || !Number.isInteger(score) || score < 0 || score > 100) {
        return "Each answer needs a whole score between 0 and 100.";
      }
    }
    return null;
  }

  function maxScoreError(): string | null {
    if (!takesMaxScore) return null;
    const n = Number(maxScore);
    if (maxScore.trim() === "" || !Number.isInteger(n) || n < 1 || n > 100) {
      return "The highest score must be a whole number between 1 and 100.";
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!templateId) return;
    const next = {
      category: requiredSelect(selectedCategoryId, "a category"),
      questionCode: tooLong(questionCode, LIMITS.code, "Question code"),
      questionText: required(questionText, "Question text") ?? tooLong(questionText, LIMITS.text, "Question text"),
      guidanceNote: tooLong(guidanceNote, LIMITS.guidance, "Guidance note"),
      options: optionsError(),
      maxScore: maxScoreError(),
      score0: isScored ? tooLong(score0, LIMITS.score, "Score 0 description") : null,
      score1: isScored ? tooLong(score1, LIMITS.score, "Score 1 description") : null,
      score2: isScored ? tooLong(score2, LIMITS.score, "Score 2 description") : null,
      score3: isScored ? tooLong(score3, LIMITS.score, "Score 3 description") : null,
    };
    setErrors(next);
    if (!isClean(next)) return;
    const chosen = options
      .filter((o) => o.optionText.trim())
      .map((o) => ({ optionText: o.optionText.trim(), score: Number(o.score) }));
    const body = {
      categoryId: selectedCategoryId,
      questionCode: questionCode.trim() || null,
      questionText: questionText.trim(),
      questionType,
      evidenceMode,
      commentMode,
      ...(isMcq ? { options: chosen } : {}),
      ...(takesMaxScore ? { maxScore: Number(maxScore) } : {}),
      guidanceNote: guidanceNote.trim() || null,
      score0Description: isScored ? score0.trim() || null : null,
      score1Description: isScored ? score1.trim() || null : null,
      score2Description: isScored ? score2.trim() || null : null,
      score3Description: isScored ? score3.trim() || null : null,
      isActive,
    };
    try {
      if (isEdit) {
        await updateQuestion({ id: id!, body }).unwrap();
        showSuccess("Question updated.");
      } else {
        await createQuestion({ templateId, body }).unwrap();
        showSuccess("Question created.");
      }
      back.go();
    } catch (err) {
      showError(errMsg(err));
    }
  }

  if (scope.loading || (isEdit && loadingExisting)) {
    return (
      <div className="flex justify-center py-20">
        <Loader size="md" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Breadcrumbs
        items={[
          ...crumbs,
          ...(categoryId
            ? [
                {
                  label: categories.find((c) => c.id === categoryId)?.name ?? "Category",
                  to: to(`/categories/${categoryId}/questions`),
                },
              ]
            : []),
          { label: isEdit ? "Edit question" : "New question" },
        ]}
      />

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-gray-900">
          {isEdit ? "Edit Question" : "New Question"}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {template ? `${template.name}. ` : ""}Choose what the farmer answers and how it is scored.
        </p>

        {scope.failed || !template ? (
          <p className="mt-6 text-sm text-gray-500">
            This assessment could not be loaded. It may have been removed, or you may not have access to it.
          </p>
        ) : !rights.editQuestions ? (
          <div className="mt-6">
            <ReasonNote>{rights.questionsReason}</ReasonNote>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Category <span className="text-danger">*</span>
              </label>
              <Select
                options={categoryOptions}
                value={selectedCategoryId}
                onChange={setSelectedCategoryId}
                disabled={isEdit}
                error={Boolean(errors.category)}
              />
              {errors.category ? (
                <p className="field-error">{errors.category}</p>
              ) : (
                isEdit && (
                  <p className="mt-1 text-xs text-gray-500">Category cannot be changed after creation.</p>
                )
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Question code
              </label>
              <input
                className={`input-field font-mono ${errors.questionCode ? "input-error" : ""}`}
                value={questionCode}
                onChange={(e) => setQuestionCode(e.target.value)}
                placeholder="e.g. b1, c3, m2"
                maxLength={LIMITS.code}
              />
              {errors.questionCode ? (
                <p className="field-error">{errors.questionCode}</p>
              ) : (
                <p className="mt-1 text-xs text-gray-500">Short identifier (from spreadsheet). Optional.</p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Question text <span className="text-danger">*</span>
              </label>
              <textarea
                className={`input-field resize-y ${
                  errors.questionText ? "input-error" : ""
                }`}
                rows={3}
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                placeholder="e.g. Pollinator habitat - Presence of flowering plant strips..."
                maxLength={LIMITS.text}
              />
              {errors.questionText && (
                <p className="field-error">{errors.questionText}</p>
              )}
            </div>

            {!picksField ? (
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                  {QUESTION_TYPE_LABELS[questionType]}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {isScored
                    ? "The farmer picks 0, 1, 2 or 3 and it scores itself."
                    : "The farmer picks one answer and it scores itself."}
                </p>
              </div>
            ) : (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Farmer fills in <span className="text-danger">*</span>
                </label>
                <Select
                  options={INPUT_TYPE_OPTIONS}
                  value={questionType}
                  onChange={(v) => setQuestionType(v as QuestionType)}
                />
                <p className="mt-1 text-xs text-gray-500">
                  {isMcq
                    ? "This field is a list to pick from, and the chosen answer carries its score."
                    : "This is one field of the category's form. An admin scores the answer during review."}
                </p>
              </div>
            )}

            {isMcq && (
              <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Answers to choose from
                </p>
                {options.map((option, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <input
                      className="input-field flex-1"
                      value={option.optionText}
                      onChange={(e) => setOption(i, { optionText: e.target.value })}
                      placeholder={`Answer ${i + 1}`}
                      maxLength={LIMITS.option}
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
                    />
                    <button
                      type="button"
                      className="mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-danger/30 text-danger hover:bg-danger/5 disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={options.length <= 2}
                      onClick={() => setOptions((rows) => rows.filter((_, index) => index !== i))}
                      aria-label={`Remove answer ${i + 1}`}
                    >
                      <TrashIcon width={16} height={16} />
                    </button>
                  </div>
                ))}
                {errors.options && <p className="field-error">{errors.options}</p>}
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={options.length >= 20}
                  onClick={() => setOptions((rows) => [...rows, { optionText: "", score: "0" }])}
                >
                  Add answer
                </button>
                <p className="text-xs text-gray-500">
                  The score of the chosen answer is what this question earns. The highest one becomes its top score.
                </p>
              </div>
            )}

            {takesMaxScore && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Highest score <span className="text-danger">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  step="1"
                  className={`input-field w-32 ${errors.maxScore ? "input-error" : ""}`}
                  value={maxScore}
                  onChange={(e) => setMaxScore(e.target.value)}
                />
                {errors.maxScore ? (
                  <p className="field-error">{errors.maxScore}</p>
                ) : (
                  <p className="mt-1 text-xs text-gray-500">
                    The most an admin can give this answer when reviewing it.
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Guidance note
              </label>
              <textarea
                className={`input-field resize-y text-sm ${errors.guidanceNote ? "input-error" : ""}`}
                rows={2}
                value={guidanceNote}
                onChange={(e) => setGuidanceNote(e.target.value)}
                placeholder="How the farmer should understand or measure this question"
                maxLength={LIMITS.guidance}
              />
              {errors.guidanceNote && <p className="field-error">{errors.guidanceNote}</p>}
            </div>

            {isScored && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                Score descriptions (0 - 3)
              </p>
              <ScoreField
                label="Score 0 - Conventional / No action"
                value={score0}
                onChange={setScore0}
                placeholder="e.g. No cover crops"
                error={errors.score0}
              />
              <ScoreField
                label="Score 1 - Awareness / Beginning"
                value={score1}
                onChange={setScore1}
                placeholder="e.g. Single-species cover"
                error={errors.score1}
              />
              <ScoreField
                label="Score 2 - Developing / Implementing"
                value={score2}
                onChange={setScore2}
                placeholder="e.g. 2-4 species mix"
                error={errors.score2}
              />
              <ScoreField
                label="Score 3 - Advanced / Regenerative"
                value={score3}
                onChange={setScore3}
                placeholder="e.g. 5+ species polyculture with legume, grass, brassica"
                error={errors.score3}
              />
            </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Evidence with the answer
                </label>
                <Select
                  options={ANSWER_EXTRA_OPTIONS}
                  value={evidenceMode}
                  onChange={(v) => setEvidenceMode(v as AnswerExtra)}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Required means the farmer cannot save the answer without evidence.
                </p>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Description with the answer
                </label>
                <Select
                  options={ANSWER_EXTRA_OPTIONS}
                  value={commentMode}
                  onChange={(v) => setCommentMode(v as AnswerExtra)}
                />
                <p className="mt-1 text-xs text-gray-500">
                  A note the farmer writes alongside the answer.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={isActive}
                onClick={() => setIsActive((v) => !v)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isActive ? "bg-primary" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    isActive ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
              <span className="text-sm font-medium text-gray-700">
                {isActive ? "Active" : "Inactive"} - only active questions appear in farmer assessments
              </span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => back.go()}
                className="btn-outline"
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={isSaving}>
                {isSaving ? "Saving..." : isEdit ? "Save changes" : "Create question"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
