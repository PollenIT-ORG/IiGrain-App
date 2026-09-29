import { Endpoints } from '../../../config/endpoints';
import { answerRepository } from '../../../repositories';
import { ENTITY_TYPES } from '../entityRegistry';
import { syncHttp } from '../syncHttp';
import type {
  DomainSyncAdapter,
  SyncAdapterContext,
  SyncAdapterResult,
} from '../types';
import type { DbAssessmentAnswer } from '../../db/types';

interface SavedAnswerEnvelope {
  data?: { response?: { id?: string; updated_at?: string } };
}

const parseEvidenceUrls = (raw: string): string[] => {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
};

const answerEndpoint = (row: DbAssessmentAnswer, fieldServerId: string): string =>
  row.author_role === 'assessor'
    ? Endpoints.assessor.saveAnswer(row.program_id, fieldServerId, row.question_id)
    : Endpoints.assessment.saveAnswer(row.program_id, fieldServerId, row.question_id);

const pushAnswer = async (
  context: SyncAdapterContext,
): Promise<SyncAdapterResult> => {
  const row = await answerRepository.getByLocalId(
    context.ownerUserId,
    context.entry.entity_local_id,
  );
  if (!row) {
    throw new Error('Answer row no longer exists locally.');
  }

  const fieldServerId = await context.resolveServerId(
    ENTITY_TYPES.field,
    row.field_local_id,
  );
  if (!fieldServerId) {
    throw new Error('Field has not been synchronised yet; answer is not sendable.');
  }

  const response = await syncHttp.put<SavedAnswerEnvelope>(
    answerEndpoint(row, fieldServerId),
    {
      score: row.score,
      comment: row.comment,
      evidenceUrls: parseEvidenceUrls(row.evidence_urls_json),
    },
  );

  const saved = response.data?.data?.response;
  return {
    serverId: saved?.id ?? null,
    serverUpdatedAt: saved?.updated_at ?? null,
  };
};

export const assessmentAnswerAdapter: DomainSyncAdapter = {
  entityType: ENTITY_TYPES.assessmentAnswer,
  create: pushAnswer,
  update: pushAnswer,
};
