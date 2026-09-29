import { nowIso } from '../services/db/ids';
import type {
  DbProgram,
  DbProgramField,
  OwnerUserId,
} from '../services/db/types';
import { execute, queryAll, queryOne, requireOwner } from './ownerScope';

export interface ProgramInput {
  readonly programId: string;
  readonly name: string;
  readonly code?: string | null;
  readonly description?: string | null;
  readonly type?: string | null;
  readonly startDate?: string | null;
  readonly endDate?: string | null;
  readonly userLimit?: number | null;
  readonly enrolledCount?: number;
  readonly isFull?: boolean;
  readonly alreadyEnrolled?: boolean;
  readonly canEnroll?: boolean;
  readonly surveyUrl?: string | null;
  readonly surveyAcres?: number | null;
}

const flag = (value: boolean | undefined): number => (value ? 1 : 0);

export const upsertProgram = async (
  owner: OwnerUserId,
  input: ProgramInput,
): Promise<DbProgram> => {
  const ownerId = requireOwner(owner);

  await execute(
    `INSERT INTO programs
       (owner_user_id, program_id, name, code, description, type, start_date, end_date,
        user_limit, enrolled_count, is_full, already_enrolled, can_enroll,
        survey_url, survey_acres, last_pulled_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (owner_user_id, program_id) DO UPDATE SET
       name = excluded.name,
       code = excluded.code,
       description = excluded.description,
       type = excluded.type,
       start_date = excluded.start_date,
       end_date = excluded.end_date,
       user_limit = excluded.user_limit,
       enrolled_count = excluded.enrolled_count,
       is_full = excluded.is_full,
       already_enrolled = excluded.already_enrolled,
       can_enroll = excluded.can_enroll,
       survey_url = excluded.survey_url,
       survey_acres = excluded.survey_acres,
       last_pulled_at = excluded.last_pulled_at`,
    [
      ownerId,
      input.programId,
      input.name,
      input.code ?? null,
      input.description ?? null,
      input.type ?? null,
      input.startDate ?? null,
      input.endDate ?? null,
      input.userLimit ?? null,
      input.enrolledCount ?? 0,
      flag(input.isFull),
      flag(input.alreadyEnrolled),
      flag(input.canEnroll),
      input.surveyUrl ?? null,
      input.surveyAcres ?? null,
      nowIso(),
    ],
  );

  const saved = await getProgram(owner, input.programId);
  if (!saved) {
    throw new Error('Failed to read back the saved program.');
  }
  return saved;
};

export const getProgram = (
  owner: OwnerUserId,
  programId: string,
): Promise<DbProgram | null> =>
  queryOne<DbProgram>(
    'SELECT * FROM programs WHERE owner_user_id = ? AND program_id = ?',
    [requireOwner(owner), programId],
  );

export const listPrograms = (owner: OwnerUserId): Promise<DbProgram[]> =>
  queryAll<DbProgram>(
    'SELECT * FROM programs WHERE owner_user_id = ? ORDER BY name COLLATE NOCASE ASC',
    [requireOwner(owner)],
  );

export const setProgramField = async (
  owner: OwnerUserId,
  programId: string,
  fieldLocalId: string,
  enrolled: boolean,
): Promise<void> => {
  await execute(
    `INSERT INTO program_fields (owner_user_id, program_id, field_local_id, enrolled, last_pulled_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (owner_user_id, program_id, field_local_id) DO UPDATE SET
       enrolled = excluded.enrolled,
       last_pulled_at = excluded.last_pulled_at`,
    [requireOwner(owner), programId, fieldLocalId, enrolled ? 1 : 0, nowIso()],
  );
};

export const listProgramFields = (
  owner: OwnerUserId,
  programId: string,
): Promise<DbProgramField[]> =>
  queryAll<DbProgramField>(
    'SELECT * FROM program_fields WHERE owner_user_id = ? AND program_id = ?',
    [requireOwner(owner), programId],
  );

export const listEnrolledProgramsForField = (
  owner: OwnerUserId,
  fieldLocalId: string,
): Promise<DbProgramField[]> =>
  queryAll<DbProgramField>(
    'SELECT * FROM program_fields WHERE owner_user_id = ? AND field_local_id = ? AND enrolled = 1',
    [requireOwner(owner), fieldLocalId],
  );
