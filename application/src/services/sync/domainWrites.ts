import { runTransaction } from '../db';
import type {
  DbFieldBoundary,
  DbFieldSoil,
  DbAssessment,
  DbAssessmentAnswer,
  DbFarm,
  DbField,
  DbMonitoringRecord,
  OwnerUserId,
} from '../db/types';
import { markSubmitPending, saveAnswer } from '../../repositories/assessmentRepository';
import {
  removeBoundary,
  saveBoundary,
} from '../../repositories/fieldBoundaryRepository';
import type { SaveBoundaryInput } from '../../repositories/fieldBoundaryRepository';
import { saveSoil } from '../../repositories/fieldSoilRepository';
import type { SoilInput } from '../../repositories/fieldSoilRepository';
import type { SaveAnswerInput } from '../../repositories/assessmentRepository';
import { farmRepository, fieldRepository, monitoringRepository } from '../../repositories';
import type { ColumnValues } from '../../repositories/ownedRepository';
import { ASSESSMENT_SUBMIT_ENTITY_TYPE } from './adapters/assessmentSubmitAdapter';
import { ENTITY_TYPES } from './entityRegistry';
import { enqueue, findActiveForEntity } from './syncQueueRepository';

export const saveAnswerOffline = async (
  owner: OwnerUserId,
  assessment: DbAssessment,
  questionId: string,
  input: SaveAnswerInput,
): Promise<DbAssessmentAnswer> =>
  runTransaction(async () => {
    const answer = await saveAnswer(owner, assessment, questionId, input);
    await enqueue(owner, {
      entityType: ENTITY_TYPES.assessmentAnswer,
      entityLocalId: answer.local_id,
      entityServerId: answer.server_id,
      operation: answer.server_id ? 'update' : 'create',
    });
    return answer;
  });

export interface OfflineWriteOptions {
  readonly outcomeUncertain?: boolean;
}

export const UNCERTAIN_PAYLOAD = JSON.stringify({ verifyFirst: true });

const uncertainPayload = (options?: OfflineWriteOptions): string | null =>
  options?.outcomeUncertain ? UNCERTAIN_PAYLOAD : null;

export const createFarmOffline = async (
  owner: OwnerUserId,
  values: ColumnValues,
  options?: OfflineWriteOptions,
): Promise<DbFarm> =>
  runTransaction(async () => {
    const farm = await farmRepository.create(owner, values);
    await enqueue(owner, {
      entityType: ENTITY_TYPES.farm,
      entityLocalId: farm.local_id,
      operation: 'create',
      payloadJson: uncertainPayload(options),
    });
    return farm;
  });

export const updateFarmOffline = async (
  owner: OwnerUserId,
  localId: string,
  patch: ColumnValues,
): Promise<DbFarm | null> =>
  runTransaction(async () => {
    const farm = await farmRepository.update(owner, localId, patch);
    if (!farm) {
      return null;
    }
    await enqueue(owner, {
      entityType: ENTITY_TYPES.farm,
      entityLocalId: farm.local_id,
      entityServerId: farm.server_id,
      operation: farm.server_id ? 'update' : 'create',
    });
    return farm;
  });

const pendingCreateIdFor = async (
  owner: OwnerUserId,
  entityType: string,
  entityLocalId: string,
): Promise<number | null> => {
  const entry = await findActiveForEntity(owner, entityType, entityLocalId);
  return entry && entry.operation === 'create' ? entry.id : null;
};

export const createFieldOffline = async (
  owner: OwnerUserId,
  farmLocalId: string,
  values: ColumnValues,
  options?: OfflineWriteOptions,
): Promise<DbField> =>
  runTransaction(async () => {
    const farm = await farmRepository.getByLocalId(owner, farmLocalId);
    if (!farm) {
      throw new Error('That farm is not available on this device.');
    }

    const field = await fieldRepository.create(owner, {
      ...values,
      farm_local_id: farmLocalId,
    });

    const dependsOnId = farm.server_id
      ? null
      : await pendingCreateIdFor(owner, ENTITY_TYPES.farm, farmLocalId);

    await enqueue(owner, {
      entityType: ENTITY_TYPES.field,
      entityLocalId: field.local_id,
      operation: 'create',
      dependsOnId,
      payloadJson: uncertainPayload(options),
    });

    return field;
  });

export const updateFieldOffline = async (
  owner: OwnerUserId,
  localId: string,
  patch: ColumnValues,
): Promise<DbField | null> =>
  runTransaction(async () => {
    const field = await fieldRepository.update(owner, localId, patch);
    if (!field) {
      return null;
    }
    await enqueue(owner, {
      entityType: ENTITY_TYPES.field,
      entityLocalId: field.local_id,
      entityServerId: field.server_id,
      operation: field.server_id ? 'update' : 'create',
    });
    return field;
  });

export const deleteFieldOffline = async (
  owner: OwnerUserId,
  localId: string,
): Promise<boolean> =>
  runTransaction(async () => {
    const field = await fieldRepository.getByLocalId(owner, localId);
    if (!field) {
      return false;
    }
    await fieldRepository.softDelete(owner, localId);
    await enqueue(owner, {
      entityType: ENTITY_TYPES.field,
      entityLocalId: localId,
      entityServerId: field.server_id,
      operation: 'delete',
    });
    return true;
  });

export const deleteFarmOffline = async (
  owner: OwnerUserId,
  localId: string,
): Promise<boolean> =>
  runTransaction(async () => {
    const farm = await farmRepository.getByLocalId(owner, localId);
    if (!farm) {
      return false;
    }
    await farmRepository.softDelete(owner, localId);
    await enqueue(owner, {
      entityType: ENTITY_TYPES.farm,
      entityLocalId: localId,
      entityServerId: farm.server_id,
      operation: 'delete',
    });
    return true;
  });

export const createMonitoringOffline = async (
  owner: OwnerUserId,
  fieldLocalId: string,
  module: string,
  values: ColumnValues,
  options?: OfflineWriteOptions,
): Promise<DbMonitoringRecord> =>
  runTransaction(async () => {
    const field = await fieldRepository.getByLocalId(owner, fieldLocalId);
    if (!field) {
      throw new Error('That field is not available on this device.');
    }

    const record = await monitoringRepository.create(owner, {
      ...values,
      field_local_id: fieldLocalId,
      module,
    });

    const dependsOnId = field.server_id
      ? null
      : await pendingCreateIdFor(owner, ENTITY_TYPES.field, fieldLocalId);

    await enqueue(owner, {
      entityType: ENTITY_TYPES.monitoringRecord,
      entityLocalId: record.local_id,
      operation: 'create',
      dependsOnId,
      payloadJson: uncertainPayload(options),
    });

    return record;
  });

export const updateMonitoringOffline = async (
  owner: OwnerUserId,
  localId: string,
  patch: ColumnValues,
): Promise<DbMonitoringRecord | null> =>
  runTransaction(async () => {
    const record = await monitoringRepository.update(owner, localId, patch);
    if (!record) {
      return null;
    }
    await enqueue(owner, {
      entityType: ENTITY_TYPES.monitoringRecord,
      entityLocalId: record.local_id,
      entityServerId: record.server_id,
      operation: record.server_id ? 'update' : 'create',
    });
    return record;
  });

export const deleteMonitoringOffline = async (
  owner: OwnerUserId,
  localId: string,
): Promise<boolean> =>
  runTransaction(async () => {
    const record = await monitoringRepository.getByLocalId(owner, localId);
    if (!record) {
      return false;
    }
    await monitoringRepository.softDelete(owner, localId);
    await enqueue(owner, {
      entityType: ENTITY_TYPES.monitoringRecord,
      entityLocalId: localId,
      entityServerId: record.server_id,
      operation: 'delete',
    });
    return true;
  });

export const pendingCreateEntryId = pendingCreateIdFor;

const fieldDependency = async (
  owner: OwnerUserId,
  fieldLocalId: string,
): Promise<number | null> => {
  const field = await fieldRepository.getByLocalId(owner, fieldLocalId);
  if (!field) {
    throw new Error('That field is not available on this device.');
  }
  return field.server_id
    ? null
    : pendingCreateIdFor(owner, ENTITY_TYPES.field, fieldLocalId);
};

export const saveBoundaryOffline = async (
  owner: OwnerUserId,
  input: SaveBoundaryInput,
): Promise<DbFieldBoundary> =>
  runTransaction(async () => {
    const dependsOnId = await fieldDependency(owner, input.fieldLocalId);
    const boundary = await saveBoundary(owner, input);
    await enqueue(owner, {
      entityType: ENTITY_TYPES.fieldBoundary,
      entityLocalId: input.fieldLocalId,
      operation: 'update',
      dependsOnId,
    });
    return boundary;
  });

export const removeBoundaryOffline = async (
  owner: OwnerUserId,
  fieldLocalId: string,
): Promise<boolean> =>
  runTransaction(async () => {
    const removed = await removeBoundary(owner, fieldLocalId);
    if (!removed) {
      return false;
    }
    await enqueue(owner, {
      entityType: ENTITY_TYPES.fieldBoundary,
      entityLocalId: fieldLocalId,
      operation: 'delete',
    });
    return true;
  });

export const saveSoilOffline = async (
  owner: OwnerUserId,
  fieldLocalId: string,
  input: SoilInput,
): Promise<DbFieldSoil> =>
  runTransaction(async () => {
    const dependsOnId = await fieldDependency(owner, fieldLocalId);
    const soil = await saveSoil(owner, fieldLocalId, input);
    await enqueue(owner, {
      entityType: ENTITY_TYPES.fieldSoil,
      entityLocalId: fieldLocalId,
      operation: 'update',
      dependsOnId,
    });
    return soil;
  });

export const submitAssessmentOffline = async (
  owner: OwnerUserId,
  assessmentLocalId: string,
): Promise<void> =>
  runTransaction(async () => {
    await markSubmitPending(owner, assessmentLocalId);
    await enqueue(owner, {
      entityType: ASSESSMENT_SUBMIT_ENTITY_TYPE,
      entityLocalId: assessmentLocalId,
      operation: 'update',
    });
  });
