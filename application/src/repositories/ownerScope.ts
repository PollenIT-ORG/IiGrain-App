import { getDatabase } from '../services/db';
import type { OwnerUserId, QueryResult } from '../services/db/types';

export type ColumnValue = string | number | null;

export const requireOwner = (ownerUserId: OwnerUserId): string => {
  const value = String(ownerUserId).trim();
  if (!value) {
    throw new Error('A repository call was made without an owner scope.');
  }
  return value;
};

export const execute = async (
  sql: string,
  params: readonly ColumnValue[] = [],
): Promise<QueryResult> => getDatabase().execute(sql, params as ColumnValue[]);

export const queryAll = async <T>(
  sql: string,
  params: readonly ColumnValue[] = [],
): Promise<T[]> => {
  const result = await execute(sql, params);
  return result.rows as unknown as T[];
};

export const queryOne = async <T>(
  sql: string,
  params: readonly ColumnValue[] = [],
): Promise<T | null> => {
  const rows = await queryAll<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
};

export const queryCount = async (
  sql: string,
  params: readonly ColumnValue[] = [],
): Promise<number> => {
  const result = await execute(sql, params);
  const row = result.rows[0];
  return row ? Number(Object.values(row)[0]) : 0;
};

export const scopedWhere = (ownerUserId: OwnerUserId, extra?: string): string => {
  requireOwner(ownerUserId);
  return extra ? `WHERE owner_user_id = ? AND ${extra}` : 'WHERE owner_user_id = ?';
};
