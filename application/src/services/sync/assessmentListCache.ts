import {
  answerRepository,
  assessmentRepository,
  farmRepository,
  fieldRepository,
  getAssessment,
  listCategories,
  listQuestions,
  upsertCategory,
} from '../../repositories';
import type {
  AssessmentCategorySummary,
  AssessmentStatus,
  FieldAssessmentSummary,
  MyAssessmentField,
  MyAssessmentsOverview,
} from '../../types/assessment';
import type { AuthorRole, DbAssessment, OwnerUserId } from '../db/types';
import { ensureLocalAssessmentScope } from './assessmentScope';

const hasUnsyncedAnswers = async (
  owner: OwnerUserId,
  assessmentLocalId: string,
): Promise<boolean> => {
  const rows = await answerRepository.listWhere(
    owner,
    "assessment_local_id = ? AND sync_state <> 'synced'",
    [assessmentLocalId],
  );
  return rows.length > 0;
};

interface ServerProgress {
  readonly status?: string;
  readonly totalQuestions?: number;
  readonly answered?: number;
  readonly percentage?: number;
  readonly submittedAt?: string | null;
  readonly title?: string | null;
  readonly year?: number | null;
}

const applyServerProgress = async (
  owner: OwnerUserId,
  assessment: DbAssessment,
  progress: ServerProgress,
): Promise<void> => {
  const patch: Record<string, string | number | null> = {};

  if (typeof progress.totalQuestions === 'number' && progress.totalQuestions > 0) {
    patch.total_questions = progress.totalQuestions;
  }
  if (progress.title) {
    patch.title = progress.title;
  }
  if (typeof progress.year === 'number' && progress.year > 0) {
    patch.year = progress.year;
  }
  if (progress.submittedAt !== undefined) {
    patch.submitted_at = progress.submittedAt;
  }

  if (!(await hasUnsyncedAnswers(owner, assessment.local_id))) {
    if (typeof progress.answered === 'number') {
      patch.answered = progress.answered;
    }
    if (typeof progress.percentage === 'number') {
      patch.percentage = progress.percentage;
    }
    if (progress.status) {
      patch.status = progress.status;
    }
  }

  if (Object.keys(patch).length > 0) {
    const updated = await assessmentRepository.update(owner, assessment.local_id, patch);
    if (updated && updated.sync_state !== 'synced') {
      await assessmentRepository.markSynced(owner, assessment.local_id, null);
    }
  }
};

export const cacheAssessmentList = async (
  owner: OwnerUserId,
  overview: MyAssessmentsOverview,
  authorRole: AuthorRole = 'farmer',
): Promise<void> => {
  for (const row of overview.fields) {
    if (!row.programId || !row.farmId || !row.fieldId) {
      continue;
    }

    const assessment = await ensureLocalAssessmentScope(owner, {
      programId: row.programId,
      fieldServerId: row.fieldId,
      farmServerId: row.farmId,
      authorRole,
      fieldName: row.fieldName,
      farmName: row.farmName,
    });

    if (row.crop) {
      const field = await fieldRepository.getByServerId(owner, row.fieldId);
      if (field && field.crop !== row.crop && field.sync_state === 'synced') {
        await fieldRepository.update(owner, field.local_id, { crop: row.crop });
        await fieldRepository.markSynced(owner, field.local_id, null);
      }
    }

    await applyServerProgress(owner, assessment, {
      status: row.status,
      totalQuestions: row.totalQuestions,
      answered: row.answered,
      percentage: row.percentage,
      submittedAt: row.submittedAtISO,
      title: overview.title,
      year: overview.year,
    });
  }
};

export const effectiveStatus = (assessment: DbAssessment): AssessmentStatus =>
  (assessment.submit_pending === 1 ? 'COMPLETED' : assessment.status) as AssessmentStatus;

export const readCachedAssessmentList = async (
  owner: OwnerUserId,
  authorRole: AuthorRole = 'farmer',
): Promise<MyAssessmentsOverview | null> => {
  const assessments = await assessmentRepository.listWhere(owner, 'author_role = ?', [
    authorRole,
  ]);
  if (assessments.length === 0) {
    return null;
  }

  const fields: MyAssessmentField[] = [];
  for (const assessment of assessments) {
    const field = await fieldRepository.getByLocalId(owner, assessment.field_local_id);
    if (!field) {
      continue;
    }
    const farm = await farmRepository.getByLocalId(owner, field.farm_local_id);
    fields.push({
      fieldId: field.server_id ?? field.local_id,
      fieldName: field.name,
      crop: field.crop ?? '',
      fieldStatus: field.status,
      farmId: farm?.server_id ?? '',
      farmName: farm?.name ?? '',
      programId: assessment.program_id,
      programName: '',
      status: effectiveStatus(assessment),
      totalQuestions: assessment.total_questions,
      answered: assessment.answered,
      percentage: assessment.percentage,
      submittedAtISO: assessment.submitted_at,
      reviewStatus: null,
    });
  }

  if (fields.length === 0) {
    return null;
  }

  const completed = fields.filter(f => f.status === 'COMPLETED').length;
  const inProgress = fields.filter(f => f.status === 'IN_PROGRESS').length;

  return {
    year: assessments[0].year ?? 0,
    title: assessments[0].title ?? '',
    counts: {
      total: fields.length,
      notStarted: fields.length - completed - inProgress,
      inProgress,
      completed,
    },
    fields,
  };
};

export const cacheAssessmentSummary = async (
  owner: OwnerUserId,
  programId: string,
  summary: FieldAssessmentSummary,
  authorRole: AuthorRole = 'farmer',
): Promise<void> => {
  const assessment = await ensureLocalAssessmentScope(owner, {
    programId,
    fieldServerId: summary.field.id,
    farmServerId: summary.field.farmId,
    authorRole,
    fieldName: summary.field.name,
    farmName: summary.field.farmName,
  });

  await applyServerProgress(owner, assessment, {
    status: summary.assessment.status,
    totalQuestions: summary.assessment.totalQuestions,
    answered: summary.assessment.answered,
    percentage: summary.assessment.percentage,
    title: summary.assessment.title,
    year: summary.assessment.year,
  });

  let order = 0;
  for (const category of summary.categories) {
    order += 1;
    await upsertCategory(owner, programId, {
      categoryId: category.id,
      name: category.name,
      totalQuestions: category.totalQuestions,
      displayOrder: order,
    });
  }
};

export const readCachedAssessmentSummary = async (
  owner: OwnerUserId,
  programId: string,
  fieldServerId: string,
  authorRole: AuthorRole = 'farmer',
): Promise<FieldAssessmentSummary | null> => {
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

  const categories = await listCategories(owner, programId);
  if (categories.length === 0) {
    return null;
  }

  const farm = await farmRepository.getByLocalId(owner, field.farm_local_id);
  const answers = await answerRepository.listWhere(owner, 'assessment_local_id = ?', [
    assessment.local_id,
  ]);
  const answeredIds = new Set(answers.map(a => a.question_id));

  const categorySummaries: AssessmentCategorySummary[] = [];
  for (const category of categories) {
    const questions = await listQuestions(owner, programId, category.category_id);
    const total = questions.length > 0 ? questions.length : category.total_questions;
    const answeredCount =
      questions.length > 0
        ? questions.filter(q => answeredIds.has(q.question_id)).length
        : 0;
    categorySummaries.push({
      id: category.category_id,
      name: category.name,
      totalQuestions: total,
      answered: answeredCount,
      percentage: total > 0 ? Math.round((answeredCount / total) * 100) : 0,
      records: 0,
    });
  }

  return {
    field: {
      id: fieldServerId,
      name: field.name,
      farmId: farm?.server_id ?? '',
      farmName: farm?.name ?? '',
    },
    assessment: {
      title: assessment.title ?? '',
      year: assessment.year ?? 0,
      status: effectiveStatus(assessment),
      totalQuestions: assessment.total_questions,
      answered: assessment.answered,
      percentage: assessment.percentage,
      submitted: effectiveStatus(assessment) === 'COMPLETED',
      questionKind: 'mcq',
    },
    canEdit: true,
    reviewStatus: null,
    program: { active: true, ended: false, endDate: null, assessmentOpen: true },
    categories: categorySummaries,
  };
};
