import {
  assessmentRepository,
  ensureAssessment,
  farmRepository,
  fieldRepository,
} from '../../repositories';
import type { AuthorRole, DbAssessment, DbField, OwnerUserId } from '../db/types';

export interface AssessmentScopeInput {
  readonly programId: string;
  readonly fieldServerId: string;
  readonly authorRole: AuthorRole;
  readonly farmServerId?: string | null;
  readonly fieldName?: string;
  readonly farmName?: string;
  readonly totalQuestions?: number;
}

const resolveField = async (
  owner: OwnerUserId,
  input: AssessmentScopeInput,
): Promise<DbField> => {
  const existing = await fieldRepository.getByServerId(owner, input.fieldServerId);
  if (existing) {
    return existing;
  }

  if (!input.farmServerId) {
    throw new Error(
      'Cannot create a local assessment scope: the field is unknown and no farm was supplied.',
    );
  }

  const farm = await farmRepository.upsertFromServer(owner, input.farmServerId, {
    name: input.farmName ?? 'Farm',
  });

  return fieldRepository.upsertFromServer(owner, input.fieldServerId, {
    farm_local_id: farm.local_id,
    name: input.fieldName ?? 'Field',
  });
};

export const ensureLocalAssessmentScope = async (
  owner: OwnerUserId,
  input: AssessmentScopeInput,
): Promise<DbAssessment> => {
  const field = await resolveField(owner, input);

  const assessment = await ensureAssessment(owner, {
    programId: input.programId,
    fieldLocalId: field.local_id,
    authorRole: input.authorRole,
  });

  if (
    typeof input.totalQuestions === 'number' &&
    input.totalQuestions > 0 &&
    assessment.total_questions !== input.totalQuestions
  ) {
    const updated = await assessmentRepository.update(owner, assessment.local_id, {
      total_questions: input.totalQuestions,
    });
    if (updated) {
      return updated;
    }
  }

  return assessment;
};
