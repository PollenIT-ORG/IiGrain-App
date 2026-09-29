import {
  answerRepository,
  getAnswer,
  listCategories,
  listQuestions,
  recomputeProgress,
  upsertCategory,
  upsertQuestion,
} from '../../repositories';
import type {
  AssessmentQuestionDetail,
  CategoryQuestionList,
  QuestionScore,
  SaveAnswerInput,
} from '../../types/assessment';
import type { DbAssessment, OwnerUserId } from '../db/types';
import { ensureLocalAssessmentScope } from './assessmentScope';
import type { AssessmentScopeInput } from './assessmentScope';

export const toScore = (value: number | null): QuestionScore | null =>
  value === 0 || value === 1 || value === 2 || value === 3 ? value : null;

export const parseUrls = (raw: string | null): string[] => {
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === 'string')
      : [];
  } catch {
    return [];
  }
};

const cacheServerAnswer = async (
  owner: OwnerUserId,
  assessment: DbAssessment,
  questionId: string,
  detail: {
    answerScore: QuestionScore | null;
    answerComment: string | null;
    answerEvidenceUrls: string[];
  },
): Promise<void> => {
  const existing = await getAnswer(owner, assessment.local_id, questionId);

  if (existing && existing.sync_state !== 'synced') {
    return;
  }

  if (detail.answerScore === null) {
    return;
  }

  const values = {
    assessment_local_id: assessment.local_id,
    question_id: questionId,
    field_local_id: assessment.field_local_id,
    program_id: assessment.program_id,
    author_role: assessment.author_role,
    score: detail.answerScore,
    comment: detail.answerComment,
    evidence_urls_json: JSON.stringify(detail.answerEvidenceUrls),
  };

  if (existing) {
    await answerRepository.update(owner, existing.local_id, values);
    await answerRepository.markSynced(owner, existing.local_id, null);
    return;
  }

  const created = await answerRepository.create(owner, values);
  await answerRepository.markSynced(owner, created.local_id, null);
};

export const recordSavedAnswer = async (
  owner: OwnerUserId,
  scope: AssessmentScopeInput,
  questionId: string,
  input: SaveAnswerInput,
): Promise<void> => {
  const assessment = await ensureLocalAssessmentScope(owner, scope);
  const existing = await getAnswer(owner, assessment.local_id, questionId);

  const values = {
    score: input.score === undefined ? existing?.score ?? null : input.score,
    comment: input.comment === undefined ? existing?.comment ?? null : input.comment,
    evidence_urls_json:
      input.evidenceUrls === undefined
        ? existing?.evidence_urls_json ?? '[]'
        : JSON.stringify(input.evidenceUrls ?? []),
  };

  if (existing) {
    await answerRepository.update(owner, existing.local_id, values);
    if (existing.sync_state === 'synced') {
      await answerRepository.markSynced(owner, existing.local_id, null);
    }
  } else {
    const created = await answerRepository.create(owner, {
      assessment_local_id: assessment.local_id,
      question_id: questionId,
      field_local_id: assessment.field_local_id,
      program_id: assessment.program_id,
      author_role: assessment.author_role,
      ...values,
    });
    await answerRepository.markSynced(owner, created.local_id, null);
  }

  await recomputeProgress(owner, assessment.local_id);
};

export interface QuestionCacheScope extends AssessmentScopeInput {
  readonly categoryId: string;
}

export const cacheQuestionDetail = async (
  owner: OwnerUserId,
  scope: QuestionCacheScope,
  detail: AssessmentQuestionDetail,
): Promise<void> => {
  const assessment = await ensureLocalAssessmentScope(owner, scope);

  await upsertQuestion(owner, {
    questionId: detail.id,
    programId: scope.programId,
    categoryId: scope.categoryId,
    questionText: detail.text,
    questionCode: detail.code,
    guidanceNote: detail.guidance,
    score0: detail.scoreDescriptions[0]?.description ?? null,
    score1: detail.scoreDescriptions[1]?.description ?? null,
    score2: detail.scoreDescriptions[2]?.description ?? null,
    score3: detail.scoreDescriptions[3]?.description ?? null,
  });

  await cacheServerAnswer(owner, assessment, detail.id, detail);
};

export const readCachedQuestionDetail = async (
  owner: OwnerUserId,
  scope: QuestionCacheScope,
  questionId: string,
): Promise<AssessmentQuestionDetail | null> => {
  const questions = await listQuestions(owner, scope.programId, scope.categoryId);
  const question = questions.find(q => q.question_id === questionId);
  if (!question) {
    return null;
  }

  const assessment = await ensureLocalAssessmentScope(owner, scope);
  const answer = await getAnswer(owner, assessment.local_id, questionId);

  return {
    id: question.question_id,
    code: question.question_code ?? '',
    text: question.question_text,
    guidance: question.guidance_note ?? '',
    questionType: 'scored',
    maxScore: 3,
    options: [],
    evidenceMode: 'optional',
    commentMode: 'optional',
    scoreDescriptions: [
      { score: 0, description: question.score0_description ?? '' },
      { score: 1, description: question.score1_description ?? '' },
      { score: 2, description: question.score2_description ?? '' },
      { score: 3, description: question.score3_description ?? '' },
    ],
    answerScore: answer ? toScore(answer.score) : null,
    answerOptionId: null,
    answerOptionText: null,
    answerText: null,
    answerNumber: null,
    answerDate: null,
    answerBoolean: null,
    answerComment: answer?.comment ?? null,
    answerEvidenceUrls: parseUrls(answer?.evidence_urls_json ?? null),
    reviewScore: null,
    finalScore: null,
    answered: !!answer,
    locked: assessment.locked === 1,
  };
};

export const cacheCategoryQuestions = async (
  owner: OwnerUserId,
  scope: QuestionCacheScope,
  list: CategoryQuestionList,
): Promise<void> => {
  await ensureLocalAssessmentScope(owner, scope);

  await upsertCategory(owner, scope.programId, {
    categoryId: scope.categoryId,
    name: list.category.name,
    totalQuestions: list.progress.totalQuestions,
  });

  let order = 0;
  for (const item of list.questions) {
    order += 1;
    await upsertQuestion(owner, {
      questionId: item.id,
      programId: scope.programId,
      categoryId: scope.categoryId,
      questionText: item.text,
      questionCode: item.code,
      guidanceNote: item.guidance,
      displayOrder: order,
    });
  }
};

export const readCachedCategoryQuestions = async (
  owner: OwnerUserId,
  scope: QuestionCacheScope,
): Promise<CategoryQuestionList | null> => {
  const questions = await listQuestions(owner, scope.programId, scope.categoryId);
  if (questions.length === 0) {
    return null;
  }

  const categories = await listCategories(owner, scope.programId);
  const category = categories.find(c => c.category_id === scope.categoryId);

  const assessment = await ensureLocalAssessmentScope(owner, scope);
  const answers = await answerRepository.listWhere(
    owner,
    'assessment_local_id = ?',
    [assessment.local_id],
  );
  const answered = new Set(answers.map(a => a.question_id));

  return {
    field: { id: scope.fieldServerId, name: scope.fieldName ?? '' },
    category: { id: scope.categoryId, name: category?.name ?? '' },
    progress: {
      totalQuestions: questions.length,
      answered: questions.filter(q => answered.has(q.question_id)).length,
      percentage:
        questions.length > 0
          ? Math.round(
              (questions.filter(q => answered.has(q.question_id)).length /
                questions.length) *
                100,
            )
          : 0,
    },
    questions: questions.map(q => ({
      id: q.question_id,
      code: q.question_code ?? '',
      text: q.question_text,
      guidance: q.guidance_note ?? '',
      answered: answered.has(q.question_id),
    })),
  };
};
