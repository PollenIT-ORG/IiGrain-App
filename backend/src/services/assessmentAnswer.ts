import ApiError from "../utils/ApiError.js";
import type {
  AnswerExtra,
  QuestionType,
  SaveAnswerBody,
} from "../validators/assessment.schema.js";
import type { AnswerColumns, QuestionWithAnswer } from "../models/assessmentMobile.model.js";

export interface AnswerableQuestion {
  id: string;
  category_id: string;
  question_type: QuestionType;
  max_score: number;
  evidence_mode: AnswerExtra;
  comment_mode: AnswerExtra;
  options: { id: string; score: number }[];
}

/** The answer as it is stored: the value it holds, and the score it earns on its own. */
export interface AnswerValues {
  score: number | null;
  optionId: string | null;
  answerText: string | null;
  answerNumber: number | null;
  answerDate: string | null;
  answerBoolean: boolean | null;
}

const TEXT_LIMITS: Record<"text" | "long_text", number> = { text: 500, long_text: 5000 };

const EMPTY: AnswerValues = {
  score: null,
  optionId: null,
  answerText: null,
  answerNumber: null,
  answerDate: null,
  answerBoolean: null,
};

/** What comes with an answer once the caller's fields and the stored ones are put together. */
export interface AnswerExtras {
  evidenceUrls: string[];
  comment: string | null;
}

/**
 * Checks an answer against the question it is for and returns what to store. A
 * multiple choice answer scores itself from the chosen answer; an input based
 * answer has no score until an admin gives one in review.
 */
export function resolveAnswer(
  question: AnswerableQuestion,
  input: SaveAnswerBody,
  extras: AnswerExtras
): AnswerValues {
  assertExtras(question, extras);

  switch (question.question_type) {
    case "scored": {
      if (input.score === undefined) throw ApiError.badRequest("A score is required.");
      return { ...EMPTY, score: input.score };
    }
    case "mcq": {
      if (!input.optionId) throw ApiError.badRequest("Choose one of the given answers.");
      const chosen = question.options.find((o) => o.id === input.optionId);
      if (!chosen) throw ApiError.badRequest("That answer is no longer one of the choices.");
      return { ...EMPTY, score: chosen.score, optionId: chosen.id };
    }
    case "text":
    case "long_text": {
      const text = input.answerText?.trim();
      if (!text) throw ApiError.badRequest("An answer is required.");
      const limit = TEXT_LIMITS[question.question_type];
      if (text.length > limit) {
        throw ApiError.badRequest(`This answer is too long (limit ${limit} characters).`);
      }
      return { ...EMPTY, answerText: text };
    }
    case "number": {
      if (input.answerNumber === undefined) throw ApiError.badRequest("Enter a number.");
      return { ...EMPTY, answerNumber: input.answerNumber };
    }
    case "date": {
      if (!input.answerDate) throw ApiError.badRequest("Choose a date.");
      return { ...EMPTY, answerDate: input.answerDate };
    }
    case "boolean": {
      if (input.answerBoolean === undefined) throw ApiError.badRequest("Choose Yes or No.");
      return { ...EMPTY, answerBoolean: input.answerBoolean };
    }
  }
}

/** The photo and the description a question asks for, or refuses. */
function assertExtras(question: AnswerableQuestion, extras: AnswerExtras): void {
  if (question.evidence_mode === "required" && extras.evidenceUrls.length === 0) {
    throw ApiError.badRequest("This question needs a photo with the answer.");
  }
  if (question.evidence_mode === "off" && extras.evidenceUrls.length > 0) {
    throw ApiError.badRequest("This question does not take a photo.");
  }
  const comment = extras.comment?.trim();
  if (question.comment_mode === "required" && !comment) {
    throw ApiError.badRequest("This question needs a description with the answer.");
  }
  if (question.comment_mode === "off" && comment) {
    throw ApiError.badRequest("This question does not take a description.");
  }
}

/** The answer as the apps read it back. */
export interface AnswerPayload {
  answerScore: number | null;
  answerOptionId: string | null;
  answerText: string | null;
  answerNumber: number | null;
  answerDate: string | null;
  answerBoolean: boolean | null;
  answerComment: string | null;
  answerEvidenceUrls: string[];
  answered: boolean;
}

export function answerPayload(
  a: Pick<
    QuestionWithAnswer,
    | "answered"
    | "answer_score"
    | "answer_option_id"
    | "answer_text"
    | "answer_number"
    | "answer_date"
    | "answer_boolean"
    | "answer_comment"
    | "answer_evidence_urls"
  >
): AnswerPayload {
  return {
    answerScore: a.answer_score,
    answerOptionId: a.answer_option_id,
    answerText: a.answer_text,
    answerNumber: a.answer_number,
    answerDate: a.answer_date,
    answerBoolean: a.answer_boolean,
    answerComment: a.answer_comment,
    answerEvidenceUrls: a.answer_evidence_urls ?? [],
    answered: a.answered,
  };
}

/** The same for a row read back from the review and history queries. */
export function rowAnswerPayload(r: AnswerColumns): AnswerPayload & {
  answerOptionText: string | null;
  reviewScore: number | null;
  finalScore: number | null;
} {
  return {
    ...answerPayload(r),
    answerOptionText: r.answer_option_text,
    reviewScore: r.review_score,
    // What the answer counts for: the score a review gave it, else its own.
    finalScore: r.review_score ?? r.answer_score,
  };
}

export interface QuestionTypePayload {
  questionType: QuestionType;
  maxScore: number;
  evidenceMode: AnswerExtra;
  commentMode: AnswerExtra;
  options: { id: string; text: string; score: number }[];
}

export function questionTypePayload(q: {
  question_type: QuestionType;
  max_score: number;
  evidence_mode: AnswerExtra;
  comment_mode: AnswerExtra;
  options?: { id: string; option_text: string; score: number }[];
}): QuestionTypePayload {
  return {
    questionType: q.question_type,
    maxScore: q.max_score,
    evidenceMode: q.evidence_mode,
    commentMode: q.comment_mode,
    options: (q.options ?? []).map((o) => ({ id: o.id, text: o.option_text, score: o.score })),
  };
}
