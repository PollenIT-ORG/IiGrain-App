import type { AssessmentQuestionDetail } from '../types/assessment';
import { hasAnswerValue, type AnswerLocalValue } from './answerValue';

export interface FormAnswerState {
  value: AnswerLocalValue;
  comment: string;
  evidenceUrls: string[];
}

export type FieldErrorKind = 'answer' | 'comment' | 'evidence';

export interface FieldError {
  questionId: string;
  index: number;
  kind: FieldErrorKind;
  message: string;
}

export type FieldErrorMap = Partial<Record<FieldErrorKind, string>>;

const MESSAGE: Record<FieldErrorKind, string> = {
  answer: 'Answer this field to save its photo or description',
  comment: 'Description is required',
  evidence: 'Photo is required',
};

/**
 * The server stores a photo or a description against an answer, never on its own
 * (resolveAnswer refuses every question type without one), so an unanswered field
 * carrying either has to be flagged rather than quietly dropped from the save.
 */
const hasExtras = (field: FormAnswerState): boolean =>
  field.evidenceUrls.length > 0 || field.comment.trim().length > 0;

const missingComment = (q: AssessmentQuestionDetail, field: FormAnswerState): boolean =>
  q.commentMode === 'required' && !field.comment.trim();

const missingEvidence = (q: AssessmentQuestionDetail, field: FormAnswerState): boolean =>
  q.evidenceMode === 'required' && field.evidenceUrls.length === 0;

export const validateCategoryForm = (
  questions: readonly AssessmentQuestionDetail[],
  fields: Readonly<Record<string, FormAnswerState>>,
): FieldError[] => {
  const errors: FieldError[] = [];
  questions.forEach((q, i) => {
    const field = fields[q.id];
    if (!field) {
      return;
    }
    if (!hasAnswerValue(q.questionType, field.value)) {
      if (hasExtras(field)) {
        errors.push({ questionId: q.id, index: i + 1, kind: 'answer', message: MESSAGE.answer });
      }
      return;
    }
    if (missingComment(q, field)) {
      errors.push({ questionId: q.id, index: i + 1, kind: 'comment', message: MESSAGE.comment });
    }
    if (missingEvidence(q, field)) {
      errors.push({ questionId: q.id, index: i + 1, kind: 'evidence', message: MESSAGE.evidence });
    }
  });
  return errors;
};

export const groupErrorsByQuestion = (
  errors: readonly FieldError[],
): Record<string, FieldErrorMap> => {
  const grouped: Record<string, FieldErrorMap> = {};
  for (const error of errors) {
    grouped[error.questionId] = { ...grouped[error.questionId], [error.kind]: error.message };
  }
  return grouped;
};

export const resumeQuestionId = (
  questions: readonly AssessmentQuestionDetail[],
  fields: Readonly<Record<string, FormAnswerState>>,
): string | null => {
  const index = questions.findIndex(q => {
    const field = fields[q.id];
    if (!field) {
      return true;
    }
    if (!hasAnswerValue(q.questionType, field.value)) {
      return true;
    }
    return missingComment(q, field) || missingEvidence(q, field);
  });
  return index > 0 ? questions[index].id : null;
};
