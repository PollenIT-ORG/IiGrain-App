import { newLocalId, nowIso } from '../services/db/ids';
import type {
  AuthorRole,
  DbAssessment,
  DbAssessmentAnswer,
  DbAssessmentCategory,
  DbAssessmentQuestion,
  OwnerUserId,
} from '../services/db/types';
import { createOwnedRepository } from './ownedRepository';
import { execute, queryAll, queryCount, queryOne, requireOwner } from './ownerScope';

export const assessmentRepository = createOwnedRepository<DbAssessment>({
  table: 'assessments',
  columns: [
    'program_id',
    'field_local_id',
    'author_role',
    'title',
    'year',
    'status',
    'total_questions',
    'answered',
    'percentage',
    'submitted_at',
    'submit_pending',
    'locked',
    'server_id',
  ],
  defaultOrderBy: 'updated_at_local DESC',
});

export const answerRepository = createOwnedRepository<DbAssessmentAnswer>({
  table: 'assessment_answers',
  columns: [
    'assessment_local_id',
    'question_id',
    'field_local_id',
    'program_id',
    'author_role',
    'score',
    'comment',
    'evidence_urls_json',
    'server_id',
  ],
  defaultOrderBy: 'updated_at_local DESC',
});

export interface AssessmentScope {
  readonly programId: string;
  readonly fieldLocalId: string;
  readonly authorRole: AuthorRole;
}

export const getAssessment = (
  owner: OwnerUserId,
  scope: AssessmentScope,
): Promise<DbAssessment | null> =>
  queryOne<DbAssessment>(
    `SELECT * FROM assessments
      WHERE owner_user_id = ? AND program_id = ? AND field_local_id = ? AND author_role = ?`,
    [requireOwner(owner), scope.programId, scope.fieldLocalId, scope.authorRole],
  );

export const ensureAssessment = async (
  owner: OwnerUserId,
  scope: AssessmentScope,
): Promise<DbAssessment> => {
  const existing = await getAssessment(owner, scope);
  if (existing) {
    return existing;
  }
  return assessmentRepository.create(owner, {
    program_id: scope.programId,
    field_local_id: scope.fieldLocalId,
    author_role: scope.authorRole,
    status: 'PENDING',
  });
};

export interface SqlStatement {
  readonly sql: string;
  readonly params: (string | number | null)[];
}

export interface CategoryInput {
  readonly categoryId: string;
  readonly name: string;
  readonly totalQuestions?: number;
  readonly displayOrder?: number;
}

export const categoryUpsert = (
  owner: OwnerUserId,
  programId: string,
  category: CategoryInput,
): SqlStatement => ({
  sql: `INSERT INTO assessment_categories
       (owner_user_id, program_id, category_id, name, total_questions, display_order, last_pulled_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (owner_user_id, program_id, category_id) DO UPDATE SET
       name = excluded.name,
       total_questions = excluded.total_questions,
       display_order = excluded.display_order,
       last_pulled_at = excluded.last_pulled_at`,
  params: [
    requireOwner(owner),
    programId,
    category.categoryId,
    category.name,
    category.totalQuestions ?? 0,
    category.displayOrder ?? 0,
    nowIso(),
  ],
});

export const upsertCategory = async (
  owner: OwnerUserId,
  programId: string,
  category: CategoryInput,
): Promise<void> => {
  const statement = categoryUpsert(owner, programId, category);
  await execute(statement.sql, statement.params);
};

export const listCategories = (
  owner: OwnerUserId,
  programId: string,
): Promise<DbAssessmentCategory[]> =>
  queryAll<DbAssessmentCategory>(
    `SELECT * FROM assessment_categories
      WHERE owner_user_id = ? AND program_id = ?
      ORDER BY display_order ASC, name COLLATE NOCASE ASC`,
    [requireOwner(owner), programId],
  );

export interface QuestionInput {
  readonly questionId: string;
  readonly programId: string;
  readonly categoryId: string;
  readonly questionText: string;
  readonly questionCode?: string | null;
  readonly guidanceNote?: string | null;
  readonly score0?: string | null;
  readonly score1?: string | null;
  readonly score2?: string | null;
  readonly score3?: string | null;
  readonly displayOrder?: number;
}

export const questionUpsert = (owner: OwnerUserId, question: QuestionInput): SqlStatement => ({
  sql: `INSERT INTO assessment_questions
       (owner_user_id, question_id, program_id, category_id, question_code, question_text,
        guidance_note, score0_description, score1_description, score2_description,
        score3_description, display_order, last_pulled_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (owner_user_id, question_id) DO UPDATE SET
       program_id = excluded.program_id,
       category_id = excluded.category_id,
       question_code = excluded.question_code,
       question_text = excluded.question_text,
       guidance_note = excluded.guidance_note,
       score0_description = COALESCE(excluded.score0_description, assessment_questions.score0_description),
       score1_description = COALESCE(excluded.score1_description, assessment_questions.score1_description),
       score2_description = COALESCE(excluded.score2_description, assessment_questions.score2_description),
       score3_description = COALESCE(excluded.score3_description, assessment_questions.score3_description),
       display_order = excluded.display_order,
       last_pulled_at = excluded.last_pulled_at`,
  params: [
    requireOwner(owner),
    question.questionId,
    question.programId,
    question.categoryId,
    question.questionCode ?? null,
    question.questionText,
    question.guidanceNote ?? null,
    question.score0 ?? null,
    question.score1 ?? null,
    question.score2 ?? null,
    question.score3 ?? null,
    question.displayOrder ?? 0,
    nowIso(),
  ],
});

export const upsertQuestion = async (
  owner: OwnerUserId,
  question: QuestionInput,
): Promise<void> => {
  const statement = questionUpsert(owner, question);
  await execute(statement.sql, statement.params);
};

export const listQuestions = (
  owner: OwnerUserId,
  programId: string,
  categoryId: string,
): Promise<DbAssessmentQuestion[]> =>
  queryAll<DbAssessmentQuestion>(
    `SELECT * FROM assessment_questions
      WHERE owner_user_id = ? AND program_id = ? AND category_id = ?
      ORDER BY display_order ASC, question_code ASC`,
    [requireOwner(owner), programId, categoryId],
  );

export const getAnswer = (
  owner: OwnerUserId,
  assessmentLocalId: string,
  questionId: string,
): Promise<DbAssessmentAnswer | null> =>
  queryOne<DbAssessmentAnswer>(
    `SELECT * FROM assessment_answers
      WHERE owner_user_id = ? AND assessment_local_id = ? AND question_id = ?`,
    [requireOwner(owner), assessmentLocalId, questionId],
  );

export const listAnswers = (
  owner: OwnerUserId,
  assessmentLocalId: string,
): Promise<DbAssessmentAnswer[]> =>
  queryAll<DbAssessmentAnswer>(
    `SELECT * FROM assessment_answers
      WHERE owner_user_id = ? AND assessment_local_id = ? AND deleted_local = 0`,
    [requireOwner(owner), assessmentLocalId],
  );

export interface SaveAnswerInput {
  readonly score: number;
  readonly comment?: string | null;
  readonly evidenceUrls?: readonly string[];
}

export const saveAnswer = async (
  owner: OwnerUserId,
  assessment: DbAssessment,
  questionId: string,
  input: SaveAnswerInput,
): Promise<DbAssessmentAnswer> => {
  if (assessment.locked === 1) {
    throw new Error('This assessment is locked and can no longer be edited.');
  }
  if (!Number.isInteger(input.score) || input.score < 0 || input.score > 3) {
    throw new Error(`Invalid score: ${String(input.score)}. Expected an integer 0-3.`);
  }

  const existing = await getAnswer(owner, assessment.local_id, questionId);

  if (existing) {
    const patch: Record<string, string | number | null> = { score: input.score };
    if (input.comment !== undefined) {
      patch.comment = input.comment;
    }
    if (input.evidenceUrls !== undefined) {
      patch.evidence_urls_json = JSON.stringify(input.evidenceUrls);
    }
    const updated = await answerRepository.update(owner, existing.local_id, patch);
    if (!updated) {
      throw new Error('Failed to update the answer.');
    }
    await recomputeProgress(owner, assessment.local_id);
    return updated;
  }

  const created = await answerRepository.create(owner, {
    assessment_local_id: assessment.local_id,
    question_id: questionId,
    field_local_id: assessment.field_local_id,
    program_id: assessment.program_id,
    author_role: assessment.author_role,
    score: input.score,
    comment: input.comment ?? null,
    evidence_urls_json: JSON.stringify(input.evidenceUrls ?? []),
  });

  await recomputeProgress(owner, assessment.local_id);
  return created;
};

export const recomputeProgress = async (
  owner: OwnerUserId,
  assessmentLocalId: string,
): Promise<DbAssessment | null> => {
  const ownerId = requireOwner(owner);
  const counted = await queryCount(
    `SELECT COUNT(*) FROM assessment_answers
      WHERE owner_user_id = ? AND assessment_local_id = ? AND deleted_local = 0`,
    [ownerId, assessmentLocalId],
  );

  const assessment = await queryOne<DbAssessment>(
    'SELECT * FROM assessments WHERE owner_user_id = ? AND local_id = ?',
    [ownerId, assessmentLocalId],
  );
  if (!assessment) {
    return null;
  }

  const answered = Math.max(counted, Number(assessment.answered) || 0);
  const total = assessment.total_questions;
  const percentage = total > 0 ? Math.round((answered / total) * 100) : 0;
  const status =
    total > 0 && answered >= total ? 'COMPLETED' : answered > 0 ? 'IN_PROGRESS' : 'PENDING';

  await execute(
    `UPDATE assessments
        SET answered = ?, percentage = ?, status = ?, updated_at_local = ?
      WHERE owner_user_id = ? AND local_id = ?`,
    [answered, percentage, status, nowIso(), ownerId, assessmentLocalId],
  );

  return queryOne<DbAssessment>(
    'SELECT * FROM assessments WHERE owner_user_id = ? AND local_id = ?',
    [ownerId, assessmentLocalId],
  );
};

export const markSubmitPending = async (
  owner: OwnerUserId,
  assessmentLocalId: string,
): Promise<void> => {
  await execute(
    `UPDATE assessments
        SET submit_pending = 1, updated_at_local = ?,
            sync_state = CASE WHEN sync_state = 'synced' THEN 'local' ELSE sync_state END
      WHERE owner_user_id = ? AND local_id = ?`,
    [nowIso(), requireOwner(owner), assessmentLocalId],
  );
};

export const clearSubmitPending = async (
  owner: OwnerUserId,
  assessmentLocalId: string,
  submittedAt: string | null,
): Promise<void> => {
  await execute(
    `UPDATE assessments
        SET submit_pending = 0,
            submitted_at = COALESCE(?, submitted_at),
            status = 'COMPLETED',
            updated_at_local = ?
      WHERE owner_user_id = ? AND local_id = ?`,
    [submittedAt, nowIso(), requireOwner(owner), assessmentLocalId],
  );
};

export const newAnswerLocalId = (): string => newLocalId();
