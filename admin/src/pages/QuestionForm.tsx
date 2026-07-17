import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  useCreateQuestionMutation,
  useUpdateQuestionMutation,
  useGetQuestionQuery,
  useListCategoriesQuery,
} from "../store/endpoints/assessmentApi";
import { showSuccess, showError } from "../lib/toast";
import { errMsg } from "../lib/errMsg";
import { required, requiredSelect, isClean } from "../lib/validation";
import Loader from "../components/Loader";
import Select from "../components/ui/Select";

function ScoreField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
      </label>
      <textarea
        className="input-field resize-y text-sm"
        rows={2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

export default function QuestionForm() {
  const navigate = useNavigate();
  const { categoryId, id } = useParams<{ categoryId: string; id: string }>();
  const isEdit = Boolean(id);

  const { data: existing, isLoading: loadingExisting } = useGetQuestionQuery(
    id!,
    { skip: !isEdit }
  );
  const { data: categories = [] } = useListCategoriesQuery();

  const [createQuestion, { isLoading: creating }] = useCreateQuestionMutation();
  const [updateQuestion, { isLoading: updating }] = useUpdateQuestionMutation();

  const [selectedCategoryId, setSelectedCategoryId] = useState(categoryId ?? "");
  const [questionCode, setQuestionCode] = useState("");
  const [questionText, setQuestionText] = useState("");
  const [guidanceNote, setGuidanceNote] = useState("");
  const [score0, setScore0] = useState("");
  const [score1, setScore1] = useState("");
  const [score2, setScore2] = useState("");
  const [score3, setScore3] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (existing) {
      setSelectedCategoryId(existing.category_id);
      setQuestionCode(existing.question_code ?? "");
      setQuestionText(existing.question_text);
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

  function backPath() {
    return categoryId
      ? `/assessments/categories/${categoryId}/questions`
      : "/assessments";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next = {
      category: requiredSelect(selectedCategoryId, "a category"),
      questionText: required(questionText, "Question text"),
    };
    setErrors(next);
    if (!isClean(next)) return;
    const body = {
      categoryId: selectedCategoryId,
      questionCode: questionCode.trim() || null,
      questionText: questionText.trim(),
      guidanceNote: guidanceNote.trim() || null,
      score0Description: score0.trim() || null,
      score1Description: score1.trim() || null,
      score2Description: score2.trim() || null,
      score3Description: score3.trim() || null,
      isActive,
    };
    try {
      if (isEdit) {
        await updateQuestion({ id: id!, body }).unwrap();
        showSuccess("Question updated.");
      } else {
        await createQuestion(body).unwrap();
        showSuccess("Question created.");
      }
      navigate(backPath());
    } catch (err) {
      showError(errMsg(err));
    }
  }

  if (isEdit && loadingExisting) {
    return (
      <div className="flex justify-center py-20">
        <Loader size="md" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <button
        onClick={() => navigate(backPath())}
        className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-900"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="m15 18-6-6 6-6" />
        </svg>
        Back to questions
      </button>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-gray-900">
          {isEdit ? "Edit Question" : "New Question"}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Score descriptions explain what 0, 1, 2, and 3 mean for this question.
        </p>

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
              className="input-field font-mono"
              value={questionCode}
              onChange={(e) => setQuestionCode(e.target.value)}
              placeholder="e.g. b1, c3, m2"
              maxLength={20}
            />
            <p className="mt-1 text-xs text-gray-500">Short identifier (from spreadsheet). Optional.</p>
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
            />
            {errors.questionText && (
              <p className="field-error">{errors.questionText}</p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Guidance note
            </label>
            <textarea
              className="input-field resize-y text-sm"
              rows={2}
              value={guidanceNote}
              onChange={(e) => setGuidanceNote(e.target.value)}
              placeholder="How the farmer should understand or measure this question"
            />
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
              Score descriptions (0 - 3)
            </p>
            <ScoreField
              label="Score 0 - Conventional / No action"
              value={score0}
              onChange={setScore0}
              placeholder="e.g. No cover crops"
            />
            <ScoreField
              label="Score 1 - Awareness / Beginning"
              value={score1}
              onChange={setScore1}
              placeholder="e.g. Single-species cover"
            />
            <ScoreField
              label="Score 2 - Developing / Implementing"
              value={score2}
              onChange={setScore2}
              placeholder="e.g. 2-4 species mix"
            />
            <ScoreField
              label="Score 3 - Advanced / Regenerative"
              value={score3}
              onChange={setScore3}
              placeholder="e.g. 5+ species polyculture with legume, grass, brassica"
            />
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
              onClick={() => navigate(backPath())}
              className="btn-outline"
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isSaving}>
              {isSaving ? "Saving…" : isEdit ? "Save changes" : "Create question"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
