import { nowIso } from '../services/db/ids';
import { asOwnerUserId } from '../services/db/types';
import type { DbUser, OwnerUserId } from '../services/db/types';
import { execute, queryAll, queryOne } from './ownerScope';

export interface LocalUserInput {
  readonly id: string;
  readonly email?: string | null;
  readonly fullName?: string | null;
  readonly role?: string | null;
}

export const upsertLocalUser = async (input: LocalUserInput): Promise<DbUser> => {
  const localId = input.id.trim();
  if (!localId) {
    throw new Error('Cannot store a local user without an id.');
  }
  const timestamp = nowIso();

  await execute(
    `INSERT INTO users (local_id, server_id, email, name, role, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (local_id) DO UPDATE SET
       server_id = excluded.server_id,
       email = COALESCE(excluded.email, users.email),
       name = COALESCE(excluded.name, users.name),
       role = COALESCE(excluded.role, users.role),
       updated_at = excluded.updated_at`,
    [
      localId,
      localId,
      input.email ?? null,
      input.fullName ?? null,
      input.role ?? null,
      timestamp,
      timestamp,
    ],
  );

  const saved = await getLocalUser(localId);
  if (!saved) {
    throw new Error('Failed to read back the local user.');
  }
  return saved;
};

export const getLocalUser = (localId: string): Promise<DbUser | null> =>
  queryOne<DbUser>('SELECT * FROM users WHERE local_id = ?', [localId]);

export const listLocalUsers = (): Promise<DbUser[]> =>
  queryAll<DbUser>('SELECT * FROM users ORDER BY updated_at DESC');

export const ownerFor = (localId: string): OwnerUserId => asOwnerUserId(localId);
