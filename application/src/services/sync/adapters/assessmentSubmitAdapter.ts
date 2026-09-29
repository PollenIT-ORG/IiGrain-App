import { isAxiosError } from 'axios';
import type { AxiosResponse } from 'axios';
import { Endpoints } from '../../../config/endpoints';
import { assessmentRepository, fieldRepository } from '../../../repositories';
import { clearSubmitPending } from '../../../repositories/assessmentRepository';
import { syncHttp } from '../syncHttp';
import type {
  DomainSyncAdapter,
  SyncAdapterContext,
  SyncAdapterResult,
} from '../types';
import type { DbAssessment } from '../../db/types';

export const ASSESSMENT_SUBMIT_ENTITY_TYPE = 'assessment_submit';

const ALREADY_SUBMITTED_STATUS = 409;

interface SubmitEnvelope {
  data?: {
    assessment?: { id?: string; status?: string; submitted_at?: string };
    submitted_at?: string;
  };
}

const requireRow = async (context: SyncAdapterContext): Promise<DbAssessment> => {
  const row = await assessmentRepository.getByLocalId(
    context.ownerUserId,
    context.entry.entity_local_id,
  );
  if (!row) {
    throw new Error('That assessment no longer exists on this device.');
  }
  return row;
};

const submit = async (context: SyncAdapterContext): Promise<SyncAdapterResult> => {
  const row = await requireRow(context);

  if (row.submit_pending === 0) {
    return { serverId: row.server_id, serverUpdatedAt: null };
  }

  const field = await fieldRepository.getByLocalId(
    context.ownerUserId,
    row.field_local_id,
  );
  const fieldId = field?.server_id ?? null;
  if (!fieldId) {
    throw new Error('The field for this assessment has not been synced yet.');
  }

  const endpoint =
    row.author_role === 'assessor'
      ? Endpoints.assessor.submit(row.program_id, fieldId)
      : Endpoints.assessment.submit(row.program_id, fieldId);

  let response: AxiosResponse<SubmitEnvelope>;
  try {
    response = await syncHttp.post<SubmitEnvelope>(endpoint);
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === ALREADY_SUBMITTED_STATUS) {
      await clearSubmitPending(context.ownerUserId, row.local_id, null);
      return { serverId: row.server_id, serverUpdatedAt: null };
    }
    throw error;
  }

  const submittedAt =
    response.data?.data?.assessment?.submitted_at ??
    response.data?.data?.submitted_at ??
    null;

  await clearSubmitPending(context.ownerUserId, row.local_id, submittedAt);

  return {
    serverId: response.data?.data?.assessment?.id ?? row.server_id,
    serverUpdatedAt: submittedAt,
  };
};

export const assessmentSubmitAdapter: DomainSyncAdapter = {
  entityType: ASSESSMENT_SUBMIT_ENTITY_TYPE,
  create: submit,
  update: submit,
};
