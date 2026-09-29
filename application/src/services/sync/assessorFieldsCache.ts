import { fieldRepository, getAssessment } from '../../repositories';
import type { AssessorFieldEntry, AssessorFieldsOverview } from '../../types/assessor';
import type { OwnerUserId } from '../db/types';
import { effectiveStatus } from './assessmentListCache';
import { readSnapshot, saveSnapshot } from './dashboardCache';

export const ASSESSOR_FIELDS_SCOPE = '__assessor_fields__';

export interface CachedAssessorFields {
  readonly overview: AssessorFieldsOverview;
  readonly capturedAt: string;
}

const percentageOf = (answered: number, total: number): number =>
  total > 0 ? Math.round((answered / total) * 100) : 0;

const withLocalProgress = async (
  owner: OwnerUserId,
  entry: AssessorFieldEntry,
): Promise<AssessorFieldEntry> => {
  if (entry.assessment.completed) {
    return entry;
  }
  const field = await fieldRepository.getByServerId(owner, entry.field.id);
  if (!field) {
    return entry;
  }
  const local = await getAssessment(owner, {
    programId: entry.program.id,
    fieldLocalId: field.local_id,
    authorRole: 'assessor',
  });
  if (!local) {
    return entry;
  }

  if (effectiveStatus(local) === 'COMPLETED') {
    return {
      ...entry,
      assessment: {
        ...entry.assessment,
        status: 'COMPLETED',
        completed: true,
        inProgress: false,
      },
    };
  }

  const answered = Math.max(entry.assessment.answered, local.answered);
  if (answered <= entry.assessment.answered) {
    return entry;
  }
  return {
    ...entry,
    assessment: {
      ...entry.assessment,
      answered,
      percentage: percentageOf(answered, entry.assessment.totalQuestions),
      status: 'IN_PROGRESS',
      inProgress: true,
    },
  };
};

const countsOf = (
  fields: readonly AssessorFieldEntry[],
): AssessorFieldsOverview['counts'] => {
  const completed = fields.filter(f => f.assessment.completed).length;
  const inProgress = fields.filter(
    f => !f.assessment.completed && f.assessment.inProgress,
  ).length;
  return {
    total: fields.length,
    notStarted: fields.length - completed - inProgress,
    inProgress,
    completed,
  };
};

export const cacheAssessorFields = async (
  owner: OwnerUserId,
  overview: AssessorFieldsOverview,
): Promise<void> => {
  await saveSnapshot(owner, ASSESSOR_FIELDS_SCOPE, overview);
};

export const readCachedAssessorFields = async (
  owner: OwnerUserId,
): Promise<CachedAssessorFields | null> => {
  const cached = await readSnapshot<AssessorFieldsOverview>(owner, ASSESSOR_FIELDS_SCOPE);
  if (!cached || !Array.isArray(cached.payload?.fields)) {
    return null;
  }

  const fields: AssessorFieldEntry[] = [];
  let changed = false;
  for (const entry of cached.payload.fields) {
    const next = await withLocalProgress(owner, entry);
    changed = changed || next !== entry;
    fields.push(next);
  }

  return {
    capturedAt: cached.capturedAt,
    overview: {
      ...cached.payload,
      fields,
      counts: changed ? countsOf(fields) : cached.payload.counts,
    },
  };
};
