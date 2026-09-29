import type { AssessmentReviewAnswer, QuestionKind, QuestionType } from "../types";

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  scored: "Score 0 to 3",
  mcq: "Multiple choice",
  text: "Short text",
  long_text: "Description",
  number: "Number",
  date: "Date",
  boolean: "Yes or No",
};

export const QUESTION_KIND_LABELS: Record<QuestionKind | "mixed", string> = {
  mcq: "MCQ based",
  input: "Input based",
  mixed: "Mixed",
};

// What a field of an input based form asks the farmer for.
export const INPUT_TYPE_OPTIONS: { value: QuestionType; label: string }[] = [
  { value: "text", label: "Short text" },
  { value: "long_text", label: "Description (long text)" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "boolean", label: "Yes or No" },
  { value: "mcq", label: "Choice from a list, each answer carries a score" },
];

export const ANSWER_EXTRA_OPTIONS = [
  { value: "off", label: "Off" },
  { value: "optional", label: "Optional" },
  { value: "required", label: "Required" },
];

/** True when the answer carries no score of its own, so an admin sets one in review. */
export function needsReviewScore(type: QuestionType): boolean {
  return type !== "scored" && type !== "mcq";
}

/** The question type a new question in a template of this kind starts as. */
export function typeForKind(kind: QuestionKind): QuestionType {
  return kind === "mcq" ? "mcq" : "text";
}

/** The answer written out for a reviewer, whatever field it came from. */
export function answerText(a: AssessmentReviewAnswer): string {
  if (!a.answered) return "Not answered";
  switch (a.questionType) {
    case "scored":
      return a.answerScore === null ? "Not answered" : `Score ${a.answerScore}`;
    case "mcq":
      return a.answerOptionText ?? "Answer no longer in the list";
    case "number":
      return a.answerNumber === null ? "Not answered" : String(a.answerNumber);
    case "date":
      return a.answerDate ?? "Not answered";
    case "boolean":
      return a.answerBoolean === null ? "Not answered" : a.answerBoolean ? "Yes" : "No";
    default:
      return a.answerText ?? "Not answered";
  }
}
