import { handleApiError } from '../../utils/handleApiError';
import { asOwnerUserId, isDatabaseReady } from '../db';
import type { OwnerUserId } from '../db/types';
import { readSnapshot, saveSnapshot } from './dashboardCache';

interface AuthLike {
  auth?: { user?: { id?: string } | null } | null;
}

export const snapshotOwner = (getState: () => unknown): OwnerUserId | null => {
  if (!isDatabaseReady()) {
    return null;
  }
  const userId = (getState() as AuthLike).auth?.user?.id;
  return userId ? asOwnerUserId(userId) : null;
};

export const throughOfflineSnapshot = async <T>(
  owner: OwnerUserId | null,
  scope: string | null,
  load: () => Promise<T>,
): Promise<T> => {
  try {
    const result = await load();
    if (owner && scope) {
      await saveSnapshot(owner, scope, result).catch(() => undefined);
    }
    return result;
  } catch (error) {
    if (owner && scope && handleApiError(error).kind === 'offline') {
      const cached = await readSnapshot<T>(owner, scope).catch(() => null);
      if (cached) {
        return cached.payload;
      }
    }
    throw error;
  }
};
