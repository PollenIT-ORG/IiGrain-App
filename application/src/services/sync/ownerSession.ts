import { APP_META_KEYS, clearAppMeta, getAppMeta, setAppMeta } from '../db/appMeta';
import { asOwnerUserId } from '../db/types';
import type { OwnerUserId } from '../db/types';
import { getLocalUser, upsertLocalUser } from '../../repositories/userRepository';
import type { LocalUserInput } from '../../repositories/userRepository';

export const establishOwner = async (
  input: LocalUserInput,
): Promise<OwnerUserId> => {
  const user = await upsertLocalUser(input);
  await setAppMeta(APP_META_KEYS.activeUserId, user.local_id);
  return asOwnerUserId(user.local_id);
};

export const resolveOwner = async (): Promise<OwnerUserId | null> => {
  const activeId = await getAppMeta(APP_META_KEYS.activeUserId);
  if (!activeId) {
    return null;
  }
  const user = await getLocalUser(activeId);
  if (!user) {
    return null;
  }
  return asOwnerUserId(user.local_id);
};

export const clearOwner = async (): Promise<void> => {
  await clearAppMeta(APP_META_KEYS.activeUserId);
};
