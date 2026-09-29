import {
  answerRepository,
  fieldRepository,
  getAssessment,
  listCategories,
  listQuestions,
  recomputeProgress,
} from '../../repositories';
import { categoryUpsert, questionUpsert } from '../../repositories/assessmentRepository';
import { queryOne, requireOwner } from '../../repositories/ownerScope';
import type {
  AssessmentQuestionDetail,
  AssessmentReview,
  AssessmentReviewCategory,
  CategoryQuestionSet,
  FieldAssessmentSummary,
  QuestionScore,
} from '../../types/assessment';
import { getDatabase, newLocalId, nowIso, runTransactionOn } from '../db';
import type { AuthorRole, DbAssessment, OwnerUserId, Transaction } from '../db/types';
import { parseUrls, toScore } from './assessmentCache';
import { effectiveStatus } from './assessmentListCache';
import { ensureLocalAssessmentScope } from './assessmentScope';
import { logSync } from './syncLogger';

export type AssessmentPackageStatus = 'READY' | 'PARTIAL' | 'MISSING';

export interface AssessmentPackageReport {
  readonly status: AssessmentPackageStatus;
  readonly categoryCount: number;
  readonly questionCount: number;
  readonly answerCount: number;
  readonly failedCategories: number;
  readonly preparedAt: string | null;
}

export interface AssessmentPackageScope {
  readonly programId: string;
  readonly fieldServerId: string;
  readonly authorRole: AuthorRole;
  readonly farmServerId?: string | null;
  readonly fieldName?: string;
  readonly farmName?: string;
}

export type CategorySetLoader = (categoryId: string) => Promise<CategoryQuestionSet>;

export interface PreparePackageOptions {
  readonly force?: boolean;
}

export const PACKAGE_REFRESH_MS = 10 * 60 * 1000;

const CATEGORY_CONCURRENCY = 3;

interface PackageRow {
  readonly status: 'READY' | 'PARTIAL';
  readonly category_count: number;
  readonly question_count: number;
  readonly answer_count: number;
  readonly failed_categories: number;
  readonly prepared_at: string;
}

interface AnswerStateRow {
  readonly local_id: string;
  readonly sync_state: string;
  readonly updated_at_local: string;
}

interface CountRow {
  readonly category_id: string;
  readonly total: number;
}

const MISSING_PACKAGE: AssessmentPackageReport = {
  status: 'MISSING',
  categoryCount: 0,
  questionCount: 0,
  answerCount: 0,
  failedCategories: 0,
  preparedAt: null,
};

const inFlight = new Map<string, Promise<AssessmentPackageReport>>();

const toReport = (row: PackageRow | null): AssessmentPackageReport =>
  row
    ? {
        status: row.status,
        categoryCount: Number(row.category_count),
        questionCount: Number(row.question_count),
        answerCount: Number(row.answer_count),
        failedCategories: Number(row.failed_categories),
        preparedAt: row.prepared_at,
      }
    : MISSING_PACKAGE;

const percentageOf = (answered: number, total: number): number =>
  total > 0 ? Math.round((answered / total) * 100) : 0;

const firstRow = <T>(result: { rows: unknown[] }): T | null =>
  (result.rows[0] as T | undefined) ?? null;

const readPackageRow = (
  owner: OwnerUserId,
  assessmentLocalId: string,
): Promise<PackageRow | null> =>
  queryOne<PackageRow>(
    `SELECT status, category_count, question_count, answer_count, failed_categories, prepared_at
       FROM assessment_packages
      WHERE owner_user_id = ? AND assessment_local_id = ?`,
    [requireOwner(owner), assessmentLocalId],
  );

const isFresh = (row: PackageRow | null): boolean =>
  row?.status === 'READY' && Date.now() - Date.parse(row.prepared_at) < PACKAGE_REFRESH_MS;

const loadCategorySets = async (
  categoryIds: readonly string[],
  load: CategorySetLoader,
): Promise<Map<string, CategoryQuestionSet>> => {
  const loaded = new Map<string, CategoryQuestionSet>();
  let cursor = 0;
  const worker = async (): Promise<void> => {
    while (cursor < categoryIds.length) {
      const categoryId = categoryIds[cursor];
      cursor += 1;
      await load(categoryId).then(
        set => {
          loaded.set(categoryId, set);
        },
        () => undefined,
      );
    }
  };
  const workers = Array.from(
    { length: Math.min(CATEGORY_CONCURRENCY, categoryIds.length) },
    worker,
  );
  await Promise.all(workers);
  return loaded;
};

const scoreText = (question: AssessmentQuestionDetail, score: QuestionScore): string | null =>
  question.scoreDescriptions.find(entry => entry.score === score)?.description || null;

const mergeServerAnswer = async (
  tx: Transaction,
  assessment: DbAssessment,
  question: AssessmentQuestionDetail,
  startedAt: string,
  stamp: string,
): Promise<void> => {
  if (question.answerScore === null) {
    return;
  }
  const existing = firstRow<AnswerStateRow>(
    await tx.execute(
      `SELECT local_id, sync_state, updated_at_local FROM assessment_answers
        WHERE owner_user_id = ? AND assessment_local_id = ? AND question_id = ?`,
      [assessment.owner_user_id, assessment.local_id, question.id],
    ),
  );
  const evidence = JSON.stringify(question.answerEvidenceUrls);

  if (existing) {
    if (existing.sync_state !== 'synced' || existing.updated_at_local > startedAt) {
      return;
    }
    await tx.execute(
      `UPDATE assessment_answers
          SET score = ?, comment = ?, evidence_urls_json = ?, last_pulled_at = ?
        WHERE owner_user_id = ? AND local_id = ?`,
      [
        question.answerScore,
        question.answerComment,
        evidence,
        stamp,
        assessment.owner_user_id,
        existing.local_id,
      ],
    );
    return;
  }

  await tx.execute(
    `INSERT INTO assessment_answers
       (local_id, server_id, owner_user_id, sync_state, deleted_local, created_at, updated_at,
        updated_at_local, server_updated_at, last_pulled_at, assessment_local_id, question_id,
        field_local_id, program_id, author_role, score, comment, evidence_urls_json)
     VALUES (?, NULL, ?, 'synced', 0, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newLocalId(),
      assessment.owner_user_id,
      stamp,
      stamp,
      stamp,
      stamp,
      assessment.local_id,
      question.id,
      assessment.field_local_id,
      assessment.program_id,
      assessment.author_role,
      question.answerScore,
      question.answerComment,
      evidence,
    ],
  );
};

const writeCategorySet = async (
  tx: Transaction,
  owner: OwnerUserId,
  assessment: DbAssessment,
  categoryId: string,
  set: CategoryQuestionSet,
  startedAt: string,
  stamp: string,
): Promise<void> => {
  let position = 0;
  for (const question of set.questions) {
    position += 1;
    const statement = questionUpsert(owner, {
      questionId: question.id,
      programId: assessment.program_id,
      categoryId,
      questionText: question.text,
      questionCode: question.code || null,
      guidanceNote: question.guidance || null,
      score0: scoreText(question, 0),
      score1: scoreText(question, 1),
      score2: scoreText(question, 2),
      score3: scoreText(question, 3),
      displayOrder: position,
    });
    await tx.execute(statement.sql, statement.params);
    await mergeServerAnswer(tx, assessment, question, startedAt, stamp);
  }

  const keep = set.questions.map(question => question.id);
  const exclusion =
    keep.length > 0 ? ` AND question_id NOT IN (${keep.map(() => '?').join(', ')})` : '';
  await tx.execute(
    `DELETE FROM assessment_questions
      WHERE owner_user_id = ? AND program_id = ? AND category_id = ?${exclusion}`,
    [requireOwner(owner), assessment.program_id, categoryId, ...keep],
  );
};

const writePackage = (
  owner: OwnerUserId,
  summary: FieldAssessmentSummary,
  assessment: DbAssessment,
  loaded: Map<string, CategoryQuestionSet>,
  previous: PackageRow | null,
  startedAt: string,
): Promise<PackageRow> =>
  runTransactionOn(getDatabase(), async tx => {
    const ownerId = requireOwner(owner);
    const stamp = nowIso();

    let order = 0;
    for (const category of summary.categories) {
      order += 1;
      const statement = categoryUpsert(owner, assessment.program_id, {
        categoryId: category.id,
        name: category.name,
        totalQuestions: category.totalQuestions,
        displayOrder: order,
      });
      await tx.execute(statement.sql, statement.params);
      const set = loaded.get(category.id);
      if (set) {
        await writeCategorySet(tx, owner, assessment, category.id, set, startedAt, stamp);
      }
    }

    const counts = await tx.execute(
      `SELECT category_id, COUNT(*) AS total FROM assessment_questions
        WHERE owner_user_id = ? AND program_id = ?
        GROUP BY category_id`,
      [ownerId, assessment.program_id],
    );
    const cached = new Map<string, number>();
    for (const row of counts.rows as unknown as CountRow[]) {
      cached.set(row.category_id, Number(row.total));
    }

    const complete = summary.categories.every(
      category => (cached.get(category.id) ?? 0) === category.totalQuestions,
    );
    const questionCount = summary.categories.reduce(
      (sum, category) => sum + (cached.get(category.id) ?? 0),
      0,
    );
    const answers = firstRow<{ total: number }>(
      await tx.execute(
        `SELECT COUNT(*) AS total FROM assessment_answers
          WHERE owner_user_id = ? AND assessment_local_id = ? AND deleted_local = 0`,
        [ownerId, assessment.local_id],
      ),
    );
    const failed = summary.categories.length - loaded.size;

    const row: PackageRow = {
      status: complete && (failed === 0 || previous?.status === 'READY') ? 'READY' : 'PARTIAL',
      category_count: summary.categories.length,
      question_count: questionCount,
      answer_count: Number(answers?.total ?? 0),
      failed_categories: failed,
      prepared_at: failed === 0 ? stamp : previous?.prepared_at ?? stamp,
    };

    await tx.execute(
      `INSERT INTO assessment_packages
         (owner_user_id, assessment_local_id, status, category_count, question_count,
          answer_count, failed_categories, prepared_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (owner_user_id, assessment_local_id) DO UPDATE SET
         status = excluded.status,
         category_count = excluded.category_count,
         question_count = excluded.question_count,
         answer_count = excluded.answer_count,
         failed_categories = excluded.failed_categories,
         prepared_at = excluded.prepared_at`,
      [
        ownerId,
        assessment.local_id,
        row.status,
        row.category_count,
        row.question_count,
        row.answer_count,
        row.failed_categories,
        row.prepared_at,
      ],
    );

    return row;
  });

const runPrepare = async (
  owner: OwnerUserId,
  scope: AssessmentPackageScope,
  summary: FieldAssessmentSummary,
  load: CategorySetLoader,
  options: PreparePackageOptions,
): Promise<AssessmentPackageReport> => {
  const assessment = await ensureLocalAssessmentScope(owner, {
    programId: scope.programId,
    fieldServerId: scope.fieldServerId,
    farmServerId: scope.farmServerId,
    authorRole: scope.authorRole,
    fieldName: scope.fieldName,
    farmName: scope.farmName,
  });
  const previous = await readPackageRow(owner, assessment.local_id);

  if (summary.categories.length === 0 || (!options.force && isFresh(previous))) {
    return toReport(previous);
  }

  const startedAt = nowIso();
  const loaded = await loadCategorySets(
    summary.categories.map(category => category.id),
    load,
  );

  if (loaded.size === 0) {
    logSync('package_unavailable', {
      entityType: 'assessment_package',
      count: summary.categories.length,
    });
    return toReport(previous);
  }

  const row = await writePackage(owner, summary, assessment, loaded, previous, startedAt);
  await recomputeProgress(owner, assessment.local_id);
  logSync('package_prepared', {
    entityType: 'assessment_package',
    status: row.status,
    count: row.question_count,
    reason: row.failed_categories > 0 ? `${row.failed_categories} categories unavailable` : undefined,
  });
  return toReport(row);
};

export const prepareAssessmentPackage = (
  owner: OwnerUserId,
  scope: AssessmentPackageScope,
  summary: FieldAssessmentSummary,
  load: CategorySetLoader,
  options: PreparePackageOptions = {},
): Promise<AssessmentPackageReport> => {
  const key = [owner, scope.authorRole, scope.programId, scope.fieldServerId].join(':');
  const running = inFlight.get(key);
  if (running) {
    return running;
  }
  const task = runPrepare(owner, scope, summary, load, options).finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, task);
  return task;
};

export const settleAssessmentPackages = async (): Promise<void> => {
  await Promise.allSettled(Array.from(inFlight.values()));
};

const findAssessment = async (
  owner: OwnerUserId,
  programId: string,
  fieldServerId: string,
  authorRole: AuthorRole,
): Promise<DbAssessment | null> => {
  const field = await fieldRepository.getByServerId(owner, fieldServerId);
  return field ? getAssessment(owner, { programId, fieldLocalId: field.local_id, authorRole }) : null;
};

export const readAssessmentPackage = async (
  owner: OwnerUserId,
  programId: string,
  fieldServerId: string,
  authorRole: AuthorRole,
): Promise<AssessmentPackageReport> => {
  const assessment = await findAssessment(owner, programId, fieldServerId, authorRole);
  return assessment ? toReport(await readPackageRow(owner, assessment.local_id)) : MISSING_PACKAGE;
};

export const readCachedAssessmentReview = async (
  owner: OwnerUserId,
  programId: string,
  fieldServerId: string,
  authorRole: AuthorRole,
): Promise<AssessmentReview | null> => {
  const field = await fieldRepository.getByServerId(owner, fieldServerId);
  if (!field) {
    return null;
  }
  const assessment = await getAssessment(owner, {
    programId,
    fieldLocalId: field.local_id,
    authorRole,
  });
  if (!assessment) {
    return null;
  }
  const pkg = await readPackageRow(owner, assessment.local_id);
  if (pkg?.status !== 'READY') {
    return null;
  }

  const answers = await answerRepository.listWhere(owner, 'assessment_local_id = ?', [
    assessment.local_id,
  ]);
  const byQuestion = new Map(answers.map(answer => [answer.question_id, answer]));

  const categories: AssessmentReviewCategory[] = [];
  for (const category of await listCategories(owner, programId)) {
    const questions = await listQuestions(owner, programId, category.category_id);
    if (questions.length === 0) {
      continue;
    }
    const items = questions.map(question => {
      const answer = byQuestion.get(question.question_id);
      return {
        id: question.question_id,
        code: question.question_code ?? '',
        text: question.question_text,
        questionType: 'scored' as const,
        maxScore: 3,
        options: [],
        evidenceMode: 'optional' as const,
        commentMode: 'optional' as const,
        score: answer ? toScore(answer.score) : null,
        optionId: null,
        optionText: null,
        answerText: null,
        answerNumber: null,
        answerDate: null,
        answerBoolean: null,
        reviewScore: null,
        finalScore: null,
        comment: answer?.comment ?? '',
        evidenceUrls: parseUrls(answer?.evidence_urls_json ?? null),
        answered: Boolean(answer),
      };
    });
    const answered = items.filter(item => item.answered).length;
    categories.push({
      id: category.category_id,
      name: category.name,
      totalQuestions: items.length,
      answered,
      percentage: percentageOf(answered, items.length),
      questions: items,
    });
  }

  const totalQuestions = categories.reduce((sum, category) => sum + category.totalQuestions, 0);
  const answered = categories.reduce((sum, category) => sum + category.answered, 0);

  return {
    field: { id: fieldServerId, name: field.name },
    submission: {
      status: effectiveStatus(assessment),
      submittedAtISO: assessment.submitted_at,
      totalQuestions,
      answered,
      percentage: percentageOf(answered, totalQuestions),
      reviewStatus: null,
      reviewNote: null,
    },
    categories,
  };
};
