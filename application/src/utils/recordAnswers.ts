import type {
  AssessmentQuestionDetail,
  AssessmentRecord,
  AssessmentRecordAnswer,
} from '../types/assessment';

const blank = (question: AssessmentQuestionDetail): AssessmentQuestionDetail => ({
  ...question,
  answerScore: null,
  answerOptionId: null,
  answerOptionText: null,
  answerText: null,
  answerNumber: null,
  answerDate: null,
  answerBoolean: null,
  answerComment: null,
  answerEvidenceUrls: [],
  answered: false,
});

const withAnswer = (
  question: AssessmentQuestionDetail,
  answer: AssessmentRecordAnswer,
): AssessmentQuestionDetail => ({
  ...question,
  answerScore: answer.score,
  answerOptionId: answer.optionId,
  answerOptionText: answer.optionText,
  answerText: answer.answerText,
  answerNumber: answer.answerNumber,
  answerDate: answer.answerDate,
  answerBoolean: answer.answerBoolean,
  answerComment: answer.comment,
  answerEvidenceUrls: answer.evidenceUrls,
  answered: true,
});

export const questionsForRecord = (
  questions: AssessmentQuestionDetail[],
  record: AssessmentRecord | null,
): AssessmentQuestionDetail[] => {
  const byId = new Map<string, AssessmentRecordAnswer>(
    (record?.answers ?? []).map(answer => [answer.questionId, answer]),
  );
  return questions.map(question => {
    const answer = byId.get(question.id);
    return answer ? withAnswer(question, answer) : blank(question);
  });
};

const FALLBACK_RECORD_NAME = 'Entry';

export const recordName = (categoryName: string): string =>
  categoryName.trim() || FALLBACK_RECORD_NAME;

export const recordLabel = (categoryName: string, number: number): string =>
  `${recordName(categoryName)} ${number}`;

export const recordAnsweredCount = (
  questions: AssessmentQuestionDetail[],
  record: AssessmentRecord,
): number => {
  const ids = new Set(questions.map(question => question.id));
  return record.answers.filter(answer => ids.has(answer.questionId)).length;
};
