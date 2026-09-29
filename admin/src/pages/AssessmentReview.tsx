import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  useGetReviewQuery,
  useSaveReviewScoresMutation,
  useApproveReviewMutation,
} from "../store/endpoints/assessmentApi";
import { showSuccess, showError } from "../lib/toast";
import { errMsg } from "../lib/errMsg";
import { useReturnTo } from "../lib/returnTo";
import { useProgramScope } from "../lib/programScope";
import { useProgramCrumbs } from "../lib/useProgramCrumbs";
import { useDialog } from "../components/ui/DialogProvider";
import { QUESTION_TYPE_LABELS, answerText, needsReviewScore } from "../lib/questionTypes";
import { fmtDateTime } from "../lib/datetime";
import Loader from "../components/Loader";
import Breadcrumbs from "../components/ui/Breadcrumbs";
import { ReasonNote } from "../components/AssessmentTemplateUi";
import type { AssessmentReviewAnswer } from "../types";

// What the reviewer typed, kept per question until it is saved.
type ScoreDraft = Record<string, string>;

// One answer's place in the drafts: its question, and its record when the form has several.
const draftKey = (a: { id: string; recordId: string | null }) => `${a.id}:${a.recordId ?? ""}`;

function StatusBadge({ status }: { status: "in_review" | "approved" }) {
  return status === "approved" ? (
    <span className="inline-flex rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">
      Approved
    </span>
  ) : (
    <span className="inline-flex rounded-full bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning">
      In review
    </span>
  );
}

function AnswerRow({
  answer,
  draft,
  editable,
  onScore,
}: {
  answer: AssessmentReviewAnswer;
  draft: string;
  editable: boolean;
  onScore: (value: string) => void;
}) {
  const scoredByAdmin = needsReviewScore(answer.questionType);
  return (
    <tr className="align-top">
      <td className="px-4 py-3">
        <p className="text-sm font-medium text-gray-900">{answer.questionText}</p>
        {answer.questionCode && (
          <p className="mt-0.5 font-mono text-xs text-gray-500">{answer.questionCode}</p>
        )}
        <span className="mt-1 inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
          {QUESTION_TYPE_LABELS[answer.questionType]}
        </span>
      </td>
      <td className="px-4 py-3">
        <p className="text-sm text-gray-800">{answerText(answer)}</p>
        {answer.answerComment && (
          <p className="mt-1 text-xs text-gray-500">{answer.answerComment}</p>
        )}
        {answer.answerEvidenceUrls.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {answer.answerEvidenceUrls.map((url) => (
              <a key={url} href={url} target="_blank" rel="noreferrer">
                <img
                  src={url}
                  alt="Answer evidence"
                  className="h-16 w-16 rounded-lg border border-gray-200 object-cover"
                />
              </a>
            ))}
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        {!answer.answered ? (
          <span className="text-xs text-gray-500">Not answered</span>
        ) : scoredByAdmin || editable ? (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              max={answer.maxScore}
              step="1"
              className="input-field w-24"
              value={draft}
              onChange={(e) => onScore(e.target.value)}
              disabled={!editable}
              aria-label={`Score for ${answer.questionText}`}
            />
            <span className="text-xs text-gray-500">of {answer.maxScore}</span>
          </div>
        ) : (
          <span className="text-sm font-semibold text-gray-900">
            {answer.finalScore ?? "-"} of {answer.maxScore}
          </span>
        )}
      </td>
    </tr>
  );
}

export default function AssessmentReview() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  // Opened from a program, this screen stays inside that program.
  const { programId, to } = useProgramScope();
  const programCrumbs = useProgramCrumbs(programId);
  const home = programId ? to("") : "/submissions";
  const back = useReturnTo(home);
  const parentCrumbs = programId
    ? programCrumbs
    : [{ label: "Submissions", to: "/submissions" }];
  const { confirm } = useDialog();

  const { data, isLoading, isError, error } = useGetReviewQuery(id, { skip: !id });
  const [saveScores, { isLoading: saving }] = useSaveReviewScoresMutation();
  const [approve, { isLoading: approving }] = useApproveReviewMutation();

  const [drafts, setDrafts] = useState<ScoreDraft>({});
  const [note, setNote] = useState("");
  // Set when the reviewer scores the whole assessment instead of every answer.
  const [overall, setOverall] = useState("");
  // Set when the reviewer scores category by category instead.
  const [categoryDrafts, setCategoryDrafts] = useState<ScoreDraft>({});

  const answers = useMemo(
    () => (data?.categories ?? []).flatMap((c) => c.questions),
    [data]
  );

  useEffect(() => {
    if (!answers.length) return;
    const next: ScoreDraft = {};
    for (const a of answers) {
      if (a.answered) next[draftKey(a)] = a.finalScore === null ? "" : String(a.finalScore);
    }
    setDrafts(next);
  }, [answers]);

  const review = data?.review;
  const editable = review?.reviewStatus === "in_review";

  // Only answers the reviewer actually changed are sent.
  function changedScores(): { questionId: string; recordId: string | null; score: number }[] {
    const out: { questionId: string; recordId: string | null; score: number }[] = [];
    for (const a of answers) {
      if (!a.answered) continue;
      const typed = drafts[draftKey(a)];
      if (typed === undefined || typed.trim() === "") continue;
      const value = Number(typed);
      if (!Number.isInteger(value)) continue;
      if (a.finalScore !== null && value === a.finalScore) continue;
      out.push({ questionId: a.id, recordId: a.recordId, score: value });
    }
    return out;
  }

  function invalidScore(): string | null {
    for (const a of answers) {
      if (!a.answered) continue;
      const typed = drafts[draftKey(a)] ?? "";
      if (typed.trim() === "") continue;
      const value = Number(typed);
      if (!Number.isInteger(value) || value < 0 || value > a.maxScore) {
        return `Give "${a.questionText}" a whole score between 0 and ${a.maxScore}.`;
      }
    }
    return null;
  }

  function missingScores(): number {
    return answers.filter((a) => a.answered && (drafts[draftKey(a)] ?? "").trim() === "").length;
  }

  async function handleSave() {
    const problem = invalidScore();
    if (problem) return showError(problem);
    try {
      await saveScores({ id, scores: changedScores(), note: note.trim() || null }).unwrap();
      showSuccess("Scores saved.");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  // The categories the reviewer has put a score against.
  function categoryScores(): { categoryId: string; score: number }[] {
    const out: { categoryId: string; score: number }[] = [];
    for (const category of data?.categories ?? []) {
      const typed = (categoryDrafts[category.id] ?? "").trim();
      if (typed === "") continue;
      out.push({ categoryId: category.id, score: Number(typed) });
    }
    return out;
  }

  // The first category whose score does not fit what it can hold.
  function invalidCategory(): string | null {
    for (const category of data?.categories ?? []) {
      const typed = (categoryDrafts[category.id] ?? "").trim();
      if (typed === "") continue;
      const value = Number(typed);
      if (!Number.isInteger(value) || value < 0 || value > category.possibleScore) {
        return `Give "${category.name}" a whole score between 0 and ${category.possibleScore}.`;
      }
    }
    return null;
  }

  // The whole assessment scored in one go: blank means score by answer instead.
  function overallScore(): number | undefined {
    const typed = overall.trim();
    if (typed === "") return undefined;
    const value = Number(typed);
    return Number.isInteger(value) ? value : NaN;
  }

  async function handleApprove() {
    const problem = invalidScore() ?? invalidCategory();
    if (problem) return showError(problem);
    const whole = overallScore();
    const possible = review?.possibleScore ?? 0;
    const byCategory = categoryScores();
    if (whole !== undefined) {
      if (Number.isNaN(whole) || whole < 0 || whole > possible) {
        return showError(`Give a whole score between 0 and ${possible} for the assessment.`);
      }
    } else if (byCategory.length > 0) {
      if (byCategory.length !== (data?.categories ?? []).length) {
        return showError("Give every category a score, or leave them all empty.");
      }
    } else if (missingScores() > 0) {
      return showError(
        "Give every answer a score, or score it by category or as a whole, before approving it."
      );
    }
    const categoryTotal = byCategory.reduce((sum, c) => sum + c.score, 0);
    const ok = await confirm({
      title: "Approve this assessment?",
      message:
        whole !== undefined
          ? `The farmer's dashboard will show ${whole} of ${possible} for this assessment. This cannot be undone.`
          : byCategory.length > 0
            ? `The farmer's dashboard will show ${categoryTotal} of ${possible}, added up from the category scores. This cannot be undone.`
            : "The final score is worked out from the scores above and appears on the farmer's dashboard. This cannot be undone.",
      confirmLabel: "Approve",
    });
    if (!ok) return;
    try {
      await approve({
        id,
        scores: changedScores(),
        categoryScores: whole === undefined && byCategory.length > 0 ? byCategory : undefined,
        overallScore: whole,
        note: note.trim() || null,
      }).unwrap();
      showSuccess("Assessment approved.");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  if (isLoading) return <Loader variant="fullPage" message="Loading assessment..." />;

  if (isError || !data || !review) {
    return (
      <div className="space-y-4">
        <Breadcrumbs items={[...parentCrumbs, { label: "Review" }]} />
        <div className="card p-6">
          <p className="text-sm text-gray-600">{errMsg(error)}</p>
          <button className="btn-secondary mt-4" onClick={() => navigate(home)}>
            {programId ? "Back to the program" : "Back to submissions"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs
          className="mb-2"
          items={[...parentCrumbs, { label: review.field.name }]}
        />
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">{review.field.name}</h1>
          <StatusBadge status={review.reviewStatus} />
        </div>
        <p className="mt-1 text-sm text-gray-500">
          {review.field.farmName} - {review.program.name} - {review.author.role === "assessor" ? "Assessor" : "Farmer"}
          {review.author.name ? `: ${review.author.name}` : ""}
        </p>
      </div>

      <div className="card grid gap-4 p-6 sm:grid-cols-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">Answered</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {review.answered} of {review.totalQuestions}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">Waiting for a score</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">{missingScores()}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">Score</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {review.reviewStatus === "approved"
              ? `${review.totalScore} of ${review.maxScore} (${review.percentage}%)`
              : "After approval"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">Submitted</p>
          <p className="mt-1 text-sm font-medium text-gray-900">
            {fmtDateTime(review.submittedAt)}
          </p>
          {review.reviewedAt && (
            <p className="mt-0.5 text-xs text-gray-500">
              Reviewed {fmtDateTime(review.reviewedAt)}
              {review.reviewerName ? ` by ${review.reviewerName}` : ""}
            </p>
          )}
        </div>
      </div>

      {!editable && (
        <ReasonNote>
          This assessment has been approved, so its scores can no longer be changed.
        </ReasonNote>
      )}

      {data.categories.map((category) => (
        <div key={category.id} className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-6 py-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
              {category.name}
            </h2>
            {editable && (
              <div className="flex items-center gap-2">
                <label htmlFor={`category-score-${category.id}`} className="text-xs text-gray-500">
                  Score this category
                </label>
                <input
                  id={`category-score-${category.id}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={category.possibleScore}
                  className="input-field w-24 py-1.5"
                  value={categoryDrafts[category.id] ?? ""}
                  onChange={(e) =>
                    setCategoryDrafts((d) => ({ ...d, [category.id]: e.target.value }))
                  }
                  placeholder="0"
                />
                <span className="text-xs text-gray-500">of {category.possibleScore}</span>
              </div>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-4 py-3">Question</th>
                  <th className="px-4 py-3">Answer</th>
                  <th className="px-4 py-3 w-48">Score</th>
                </tr>
              </thead>
              {/* A form filled in several times shows each record under its own heading. */}
              {category.records.map((record) => (
                <tbody key={record.id ?? "single"} className="divide-y divide-gray-100">
                  {record.id && (
                    <tr className="bg-primary/5">
                      <td colSpan={3} className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-primary">
                        Record {record.number} of {category.records.length}
                      </td>
                    </tr>
                  )}
                  {record.questions.map((answer) => (
                    <AnswerRow
                      key={draftKey(answer)}
                      answer={answer}
                      draft={drafts[draftKey(answer)] ?? ""}
                      editable={Boolean(editable)}
                      onScore={(value) => setDrafts((d) => ({ ...d, [draftKey(answer)]: value }))}
                    />
                  ))}
                  <tr>
                    <td colSpan={3} className="px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                        {record.id ? "Evidence for this record" : "Evidence for this category"}
                      </p>
                      {record.evidenceUrls.length === 0 ? (
                        <p className="mt-1 text-sm text-gray-400">None uploaded</p>
                      ) : (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {record.evidenceUrls.map((url) => (
                            <a key={url} href={url} target="_blank" rel="noreferrer">
                              <img
                                src={url}
                                alt="Form evidence"
                                className="h-16 w-16 rounded-lg border border-gray-200 object-cover"
                              />
                            </a>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                </tbody>
              ))}
            </table>
          </div>
        </div>
      ))}

      {editable && (
        <div className="card space-y-4 p-6">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <label htmlFor="review-overall" className="label">
              One score for the whole assessment
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                id="review-overall"
                type="number"
                inputMode="numeric"
                min={0}
                max={review.possibleScore}
                className="input-field w-32"
                value={overall}
                onChange={(e) => setOverall(e.target.value)}
                placeholder="0"
              />
              <span className="text-sm text-gray-600">of {review.possibleScore}</span>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              There are three ways to score this: answer by answer below, one score per category on
              each category header, or this one score for the whole assessment. Fill in whichever
              suits you and leave the others empty. This box wins over the category scores, and the
              category scores win over the answer scores. When a form was filled in more than once,
              each record is scored on its own and the form counts as the average of its records.
            </p>
          </div>

          <div>
            <label htmlFor="review-note" className="label">
              Review note
            </label>
            <textarea
              id="review-note"
              className="input-field min-h-[80px] resize-y"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What this score is based on (optional)"
              maxLength={2000}
            />
          </div>
          <div className="flex flex-wrap justify-end gap-3">
            <button className="btn-secondary" onClick={() => back.go()}>
              Back
            </button>
            <button className="btn-secondary" disabled={saving} onClick={() => void handleSave()}>
              {saving ? "Saving..." : "Save scores"}
            </button>
            <button className="btn-primary" disabled={approving} onClick={() => void handleApprove()}>
              {approving ? "Approving..." : "Approve"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
