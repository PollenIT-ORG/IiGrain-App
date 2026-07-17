import type {
  AssessmentCategory,
  AssessmentProgress,
  AssessmentQuestion,
  EvidenceFile,
  QuestionScore,
} from '../types/assessment';
import { assessmentCategories } from '../data/assessmentCategoryDummy';
import { assessmentQuestions } from '../data/assessmentQuestionsDummy';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const store: Record<string, AssessmentQuestion[]> = clone(assessmentQuestions);

const delay = <T>(value: T, ms = 250): Promise<T> =>
  new Promise(resolve => setTimeout(() => resolve(value), ms));

const computeProgress = (questions: AssessmentQuestion[]): AssessmentProgress => {
  const total = questions.length;
  let completed = 0;
  let inProgress = 0;
  let notStarted = 0;
  let reviewRequired = 0;
  questions.forEach(q => {
    switch (q.status) {
      case 'COMPLETED':
        completed += 1;
        break;
      case 'IN_PROGRESS':
        inProgress += 1;
        break;
      case 'REVIEW_REQUIRED':
        reviewRequired += 1;
        break;
      default:
        notStarted += 1;
    }
  });
  return {
    total,
    completed,
    inProgress,
    notStarted,
    reviewRequired,
    percentage: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
};

export interface SaveQuestionInput {
  questionId: string;
  score: QuestionScore | null;
  comment: string;
  attachments: EvidenceFile[];
}

const findQuestion = (questionId: string): AssessmentQuestion | undefined => {
  for (const list of Object.values(store)) {
    const found = list.find(q => q.id === questionId);
    if (found) {
      return found;
    }
  }
  return undefined;
};

const applyEdit = (
  input: SaveQuestionInput,
  status: AssessmentQuestion['status'],
): AssessmentQuestion | undefined => {
  const question = findQuestion(input.questionId);
  if (!question) {
    return undefined;
  }
  question.score = input.score;
  question.comment = input.comment;
  question.attachments = input.attachments;
  question.status = status;
  question.lastUpdatedISO = new Date().toISOString();
  return clone(question);
};

export const assessmentRepository = {
  getCategories: (): Promise<AssessmentCategory[]> => delay(clone(assessmentCategories)),

  getCategory: (categoryId: string): Promise<AssessmentCategory | undefined> =>
    delay(clone(assessmentCategories.find(c => c.id === categoryId))),

  getQuestions: (categoryId: string): Promise<AssessmentQuestion[]> =>
    delay(clone(store[categoryId] ?? [])),

  getQuestion: (questionId: string): Promise<AssessmentQuestion | undefined> =>
    delay(clone(findQuestion(questionId))),

  getCategoryProgress: (categoryId: string): Promise<AssessmentProgress> =>
    delay(computeProgress(store[categoryId] ?? [])),

  saveDraft: (input: SaveQuestionInput): Promise<AssessmentQuestion | undefined> => {
    const isEmpty = input.score === null && !input.comment.trim() && input.attachments.length === 0;
    return delay(applyEdit(input, isEmpty ? 'NOT_STARTED' : 'IN_PROGRESS'));
  },

  submitQuestion: (input: SaveQuestionInput): Promise<AssessmentQuestion | undefined> =>
    delay(applyEdit(input, 'COMPLETED')),

  submitAssessment: (): Promise<void> => delay(undefined),
};

export type AssessmentRepository = typeof assessmentRepository;
