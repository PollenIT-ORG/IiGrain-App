import { Platform } from 'react-native';
import {
  ANDROID_DATABASE_PATH,
  IOS_LIBRARY_PATH,
  open,
} from '@op-engineering/op-sqlite';
import { LATEST_SCHEMA_VERSION, readSchemaVersion, runMigrations } from './migrations';
import type { DB, DatabaseStatus, JournalMode, QueryResult, Scalar } from './types';

export const DATABASE_NAME = 'iigrain.sqlite';

export const databaseLocation = (): string =>
  Platform.OS === 'ios' ? IOS_LIBRARY_PATH : ANDROID_DATABASE_PATH;

let connection: DB | null = null;
let status: DatabaseStatus | null = null;
let initialization: Promise<DatabaseStatus> | null = null;

const firstValue = (result: QueryResult): Scalar | undefined => {
  const row = result.rows[0];
  return row ? Object.values(row)[0] : undefined;
};

const configureJournalMode = async (db: DB): Promise<JournalMode> => {
  await db.execute('PRAGMA journal_mode = WAL');
  const verified = await db.execute('PRAGMA journal_mode');
  const mode = String(firstValue(verified) ?? '').toLowerCase() as JournalMode;
  if (mode !== 'wal') {
    throw new Error(
      `Expected journal_mode "wal" but the database reported "${mode}". Refusing to continue.`,
    );
  }
  return mode;
};

const configureForeignKeys = async (db: DB): Promise<boolean> => {
  await db.execute('PRAGMA foreign_keys = ON');
  const verified = await db.execute('PRAGMA foreign_keys');
  const enabled = Number(firstValue(verified) ?? 0) === 1;
  if (!enabled) {
    throw new Error(
      'Expected foreign_keys to be enabled but the database reported it as off. Refusing to continue.',
    );
  }
  return enabled;
};

const readSqliteVersion = async (db: DB): Promise<string> => {
  const result = await db.execute('SELECT sqlite_version() AS version');
  return String(firstValue(result) ?? 'unknown');
};

const bootstrap = async (): Promise<DatabaseStatus> => {
  const location = databaseLocation();
  const db = open({ name: DATABASE_NAME, location });

  try {
    const journalMode = await configureJournalMode(db);
    const foreignKeys = await configureForeignKeys(db);
    const sqliteVersion = await readSqliteVersion(db);

    const schemaVersion = await runMigrations(db);
    if (schemaVersion !== LATEST_SCHEMA_VERSION) {
      throw new Error(
        `Schema version ${schemaVersion} does not match the expected ${LATEST_SCHEMA_VERSION}.`,
      );
    }

    connection = db;
    status = {
      name: DATABASE_NAME,
      location,
      journalMode,
      foreignKeys,
      schemaVersion,
      sqliteVersion,
    };
    return status;
  } catch (error) {
    connection = null;
    status = null;
    try {
      db.close();
    } catch {
      throw error;
    }
    throw error;
  }
};

export const initializeDatabase = async (): Promise<DatabaseStatus> => {
  if (status) {
    return status;
  }
  if (!initialization) {
    initialization = bootstrap().finally(() => {
      initialization = null;
    });
  }
  return initialization;
};

export const getDatabase = (): DB => {
  if (!connection) {
    throw new Error(
      'Database is not initialized. Call initializeDatabase() during app startup before using SQLite.',
    );
  }
  return connection;
};

export const getDatabaseStatus = (): DatabaseStatus | null => status;

export const isDatabaseReady = (): boolean => connection !== null;

export const closeDatabase = async (): Promise<void> => {
  if (initialization) {
    try {
      await initialization;
    } catch {
      connection = null;
    }
  }
  const db = connection;
  connection = null;
  status = null;
  if (db) {
    db.close();
  }
};

export const getSchemaVersion = async (): Promise<number> =>
  readSchemaVersion(getDatabase());
