import type { QuestionType, SaveAnswerInput, SaveFormAnswerInput } from '../types/assessment';
import { hasAnswerValue, type AnswerLocalValue } from './answerValue';

export interface AnswerBaseline {
  comment: string | null;
  evidenceUrls: string[];
}

const sameUrls = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((url, i) => url === b[i]);

export const applyAnswerField = (body: SaveAnswerInput, questionType: QuestionType, value: AnswerLocalValue): void => {
  switch (questionType) {
    case 'scored':
      if (value.score !== null) {
        body.score = value.score;
      }
      return;
    case 'mcq':
      if (value.optionId !== null) {
        body.optionId = value.optionId;
      }
      return;
    case 'text':
    case 'long_text':
      body.answerText = value.text.trim();
      return;
    case 'number': {
      const n = Number(value.number);
      if (value.number.trim() !== '' && Number.isFinite(n)) {
        body.answerNumber = n;
      }
      return;
    }
    case 'date':
      if (value.date !== null) {
        body.answerDate = value.date;
      }
      return;
    case 'boolean':
      if (value.boolean !== null) {
        body.answerBoolean = value.boolean;
      }
      return;
    default:
      return;
  }
};

export const buildAnswerPayload = (
  questionType: QuestionType,
  value: AnswerLocalValue,
  comment: string,
  evidenceUrls: string[],
  baseline: AnswerBaseline | null,
): SaveAnswerInput => {
  const body: SaveAnswerInput = {};
  applyAnswerField(body, questionType, value);

  const nextComment = comment.trim();
  const prevComment = (baseline?.comment ?? '').trim();
  if (nextComment !== prevComment) {
    body.comment = nextComment === '' ? null : nextComment;
  }

  const prevUrls = baseline?.evidenceUrls ?? [];
  if (!sameUrls(evidenceUrls, prevUrls)) {
    body.evidenceUrls = evidenceUrls.length === 0 ? null : evidenceUrls;
  }

  return body;
};

export interface FormFieldState {
  questionType: QuestionType;
  value: AnswerLocalValue;
  comment: string;
  evidenceUrls: string[];
}

export const buildFormAnswerEntry = (
  questionId: string,
  field: FormFieldState,
  baseline: AnswerBaseline | null,
): SaveFormAnswerInput | null => {
  if (!hasAnswerValue(field.questionType, field.value)) {
    return null;
  }
  return {
    questionId,
    ...buildAnswerPayload(field.questionType, field.value, field.comment, field.evidenceUrls, baseline),
  };
};
