import { getDatabase } from './database';
import { nowIso } from './ids';

export const APP_META_KEYS = {
  activeUserId: 'active_user_id',
  deviceInstallId: 'device_install_id',
} as const;

export const setAppMeta = async (key: string, value: string): Promise<void> => {
  await getDatabase().execute(
    `INSERT INTO app_meta (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [key, value, nowIso()],
  );
};

export const getAppMeta = async (key: string): Promise<string | null> => {
  const result = await getDatabase().execute(
    'SELECT value FROM app_meta WHERE key = ?',
    [key],
  );
  const row = result.rows[0];
  return row ? (row.value as string | null) : null;
};

export const clearAppMeta = async (key: string): Promise<void> => {
  await getDatabase().execute('DELETE FROM app_meta WHERE key = ?', [key]);
};
