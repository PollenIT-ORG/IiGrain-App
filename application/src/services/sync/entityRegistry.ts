import {
  answerRepository,
  assessmentRepository,
  documentRepository,
  farmRepository,
  fieldRepository,
  monitoringRepository,
} from '../../repositories';
import type { OwnedRepository } from '../../repositories/ownedRepository';
import type { OwnedRow, OwnerUserId } from '../db/types';
import type { EntitySyncWriter } from './types';

export const ENTITY_TYPES = {
  farm: 'farm',
  field: 'field',
  fieldBoundary: 'field_boundary',
  fieldSoil: 'field_soil',
  assessment: 'assessment',
  assessmentAnswer: 'assessment_answer',
  monitoringRecord: 'monitoring_record',
  document: 'document',
} as const;

export type EntityType = (typeof ENTITY_TYPES)[keyof typeof ENTITY_TYPES];

const REPOSITORIES: Record<string, OwnedRepository<OwnedRow>> = {
  [ENTITY_TYPES.farm]: farmRepository as OwnedRepository<OwnedRow>,
  [ENTITY_TYPES.field]: fieldRepository as OwnedRepository<OwnedRow>,
  [ENTITY_TYPES.assessment]: assessmentRepository as OwnedRepository<OwnedRow>,
  [ENTITY_TYPES.assessmentAnswer]: answerRepository as OwnedRepository<OwnedRow>,
  [ENTITY_TYPES.monitoringRecord]: monitoringRepository as OwnedRepository<OwnedRow>,
  [ENTITY_TYPES.document]: documentRepository as OwnedRepository<OwnedRow>,
};

export const repositoryFor = (
  entityType: string,
): OwnedRepository<OwnedRow> | null => REPOSITORIES[entityType] ?? null;

export const repositoryEntityWriter: EntitySyncWriter = {
  async applyServerId(ownerUserId, entityType, entityLocalId, serverId) {
    const repository = repositoryFor(entityType);
    if (!repository) {
      return;
    }
    await repository.setServerId(ownerUserId, entityLocalId, serverId);
  },

  async markSynced(ownerUserId, entityType, entityLocalId, serverUpdatedAt) {
    const repository = repositoryFor(entityType);
    if (!repository) {
      return;
    }
    await repository.markSynced(ownerUserId, entityLocalId, serverUpdatedAt);
  },

  async readServerId(
    ownerUserId: OwnerUserId,
    entityType: string,
    entityLocalId: string,
  ) {
    const repository = repositoryFor(entityType);
    if (!repository) {
      return null;
    }
    const row = await repository.getByLocalId(ownerUserId, entityLocalId);
    return row?.server_id ?? null;
  },
};
