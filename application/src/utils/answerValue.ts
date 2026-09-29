import type { AssessmentQuestionDetail, QuestionScore, QuestionType } from '../types/assessment';

export interface AnswerLocalValue {
  score: QuestionScore | null;
  optionId: string | null;
  text: string;
  number: string;
  date: string | null;
  boolean: boolean | null;
}

export const EMPTY_ANSWER_VALUE: AnswerLocalValue = {
  score: null,
  optionId: null,
  text: '',
  number: '',
  date: null,
  boolean: null,
};

export const answerValueFromDetail = (
  detail: Pick<
    AssessmentQuestionDetail,
    'answerScore' | 'answerOptionId' | 'answerText' | 'answerNumber' | 'answerDate' | 'answerBoolean'
  >,
): AnswerLocalValue => ({
  score: detail.answerScore,
  optionId: detail.answerOptionId,
  text: detail.answerText ?? '',
  number: detail.answerNumber !== null && detail.answerNumber !== undefined
    ? String(detail.answerNumber)
    : '',
  date: detail.answerDate,
  boolean: detail.answerBoolean,
});

export const hasAnswerValue = (
  questionType: QuestionType,
  value: AnswerLocalValue,
): boolean => {
  switch (questionType) {
    case 'scored':
      return value.score !== null;
    case 'mcq':
      return value.optionId !== null;
    case 'text':
    case 'long_text':
      return value.text.trim().length > 0;
    case 'number':
      return value.number.trim().length > 0 && Number.isFinite(Number(value.number));
    case 'date':
      return value.date !== null;
    case 'boolean':
      return value.boolean !== null;
    default:
      return false;
  }
};

export const sanitizeNumberText = (text: string): string => {
  const negative = text.trim().startsWith('-');
  let digits = text.replace(/[^0-9.]/g, '');
  const firstDot = digits.indexOf('.');
  if (firstDot >= 0) {
    digits = digits.slice(0, firstDot + 1) + digits.slice(firstDot + 1).replace(/\./g, '');
  }
  return negative ? `-${digits}` : digits;
};
