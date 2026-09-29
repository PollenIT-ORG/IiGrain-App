import { createDomainSchema } from './domainSchema';
import type { DB, Migration, Transaction } from './types';

const createFoundationSchema = async (tx: Transaction): Promise<void> => {
  await tx.execute(
    `CREATE TABLE IF NOT EXISTS app_meta (
       key        TEXT PRIMARY KEY,
       value      TEXT,
       updated_at TEXT NOT NULL
     )`,
  );

  await tx.execute(
    `CREATE TABLE IF NOT EXISTS users (
       local_id   TEXT PRIMARY KEY,
       server_id  TEXT,
       email      TEXT,
       name       TEXT,
       role       TEXT,
       created_at TEXT NOT NULL,
       updated_at TEXT NOT NULL
     )`,
  );

  await tx.execute(
    'CREATE UNIQUE INDEX IF NOT EXISTS uq_users_server_id ON users (server_id) WHERE server_id IS NOT NULL',
  );

  await tx.execute(
    `CREATE TABLE IF NOT EXISTS sync_state (
       id                     INTEGER PRIMARY KEY,
       owner_user_id          TEXT NOT NULL,
       last_sync_started_at   TEXT,
       last_sync_completed_at TEXT,
       last_sync_error        TEXT,
       status                 TEXT NOT NULL,
       updated_at             TEXT NOT NULL,
       FOREIGN KEY (owner_user_id) REFERENCES users (local_id) ON DELETE CASCADE
     )`,
  );

  await tx.execute(
    'CREATE UNIQUE INDEX IF NOT EXISTS uq_sync_state_owner ON sync_state (owner_user_id)',
  );

  await tx.execute(
    `CREATE TABLE IF NOT EXISTS sync_queue (
       id               INTEGER PRIMARY KEY AUTOINCREMENT,
       owner_user_id    TEXT NOT NULL,
       entity_type      TEXT NOT NULL,
       entity_local_id  TEXT NOT NULL,
       entity_server_id TEXT,
       operation        TEXT NOT NULL,
       payload_json     TEXT,
       idempotency_key  TEXT NOT NULL UNIQUE,
       status           TEXT NOT NULL,
       attempt_count    INTEGER NOT NULL DEFAULT 0,
       available_at     TEXT NOT NULL,
       created_at       TEXT NOT NULL,
       updated_at       TEXT NOT NULL,
       last_error       TEXT,
       FOREIGN KEY (owner_user_id) REFERENCES users (local_id) ON DELETE CASCADE,
       CHECK (operation IN ('create', 'update', 'delete')),
       CHECK (status IN ('pending', 'processing', 'failed', 'completed'))
     )`,
  );

  await tx.execute(
    'CREATE INDEX IF NOT EXISTS idx_sync_queue_owner ON sync_queue (owner_user_id)',
  );
  await tx.execute(
    'CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue (status)',
  );
  await tx.execute(
    'CREATE INDEX IF NOT EXISTS idx_sync_queue_available_at ON sync_queue (available_at)',
  );
  await tx.execute(
    'CREATE INDEX IF NOT EXISTS idx_sync_queue_claim ON sync_queue (owner_user_id, status, available_at)',
  );
  await tx.execute(
    'CREATE INDEX IF NOT EXISTS idx_sync_queue_entity ON sync_queue (entity_type, entity_local_id)',
  );
};

const addSyncQueueDependencies = async (tx: Transaction): Promise<void> => {
  await tx.execute(
    'ALTER TABLE sync_queue ADD COLUMN depends_on_id INTEGER REFERENCES sync_queue (id) ON DELETE SET NULL',
  );
  await tx.execute('ALTER TABLE sync_queue ADD COLUMN claimed_at TEXT');
  await tx.execute(
    'CREATE INDEX IF NOT EXISTS idx_sync_queue_depends_on ON sync_queue (depends_on_id)',
  );
  await tx.execute(
    'CREATE INDEX IF NOT EXISTS idx_sync_queue_claimed_at ON sync_queue (status, claimed_at)',
  );
};

const addMediaUploadContext = async (tx: Transaction): Promise<void> => {
  await tx.execute('ALTER TABLE media_files ADD COLUMN context_json TEXT');
  await tx.execute(
    'CREATE INDEX IF NOT EXISTS idx_media_purpose ON media_files (owner_user_id, purpose)',
  );
};

const addDashboardSnapshots = async (tx: Transaction): Promise<void> => {
  await tx.execute(
    `CREATE TABLE IF NOT EXISTS dashboard_snapshots (
       owner_user_id TEXT NOT NULL,
       scope         TEXT NOT NULL,
       year          INTEGER NOT NULL DEFAULT 0,
       payload_json  TEXT NOT NULL,
       captured_at   TEXT NOT NULL,
       PRIMARY KEY (owner_user_id, scope, year),
       FOREIGN KEY (owner_user_id) REFERENCES users (local_id) ON DELETE CASCADE
     )`,
  );
  await tx.execute(
    'CREATE INDEX IF NOT EXISTS idx_dashboard_owner ON dashboard_snapshots (owner_user_id)',
  );
};

const addAssessmentPackages = async (tx: Transaction): Promise<void> => {
  await tx.execute(
    `CREATE TABLE IF NOT EXISTS assessment_packages (
       owner_user_id       TEXT NOT NULL,
       assessment_local_id TEXT NOT NULL,
       status              TEXT NOT NULL,
       category_count      INTEGER NOT NULL DEFAULT 0,
       question_count      INTEGER NOT NULL DEFAULT 0,
       answer_count        INTEGER NOT NULL DEFAULT 0,
       failed_categories   INTEGER NOT NULL DEFAULT 0,
       prepared_at         TEXT NOT NULL,
       PRIMARY KEY (owner_user_id, assessment_local_id),
       FOREIGN KEY (owner_user_id) REFERENCES users (local_id) ON DELETE CASCADE,
       FOREIGN KEY (assessment_local_id) REFERENCES assessments (local_id) ON DELETE CASCADE,
       CHECK (status IN ('READY', 'PARTIAL'))
     )`,
  );
};

export const MIGRATIONS: readonly Migration[] = [
  { version: 1, name: 'foundation_schema', up: createFoundationSchema },
  { version: 2, name: 'domain_schema', up: createDomainSchema },
  { version: 3, name: 'sync_queue_dependencies', up: addSyncQueueDependencies },
  { version: 4, name: 'media_upload_context', up: addMediaUploadContext },
  { version: 5, name: 'dashboard_snapshots', up: addDashboardSnapshots },
  { version: 6, name: 'assessment_packages', up: addAssessmentPackages },
];

export const LATEST_SCHEMA_VERSION = MIGRATIONS.reduce(
  (highest, migration) => Math.max(highest, migration.version),
  0,
);

const assertMigrationsAreWellFormed = (migrations: readonly Migration[]): void => {
  const seen = new Set<number>();
  for (const migration of migrations) {
    if (!Number.isInteger(migration.version) || migration.version < 1) {
      throw new Error(
        `Migration "${migration.name}" has an invalid version: ${String(migration.version)}.`,
      );
    }
    if (seen.has(migration.version)) {
      throw new Error(`Duplicate migration version ${migration.version}.`);
    }
    seen.add(migration.version);
  }
};

export const readSchemaVersion = async (db: DB): Promise<number> => {
  const result = await db.execute('PRAGMA user_version');
  const row = result.rows[0];
  const value = row ? Object.values(row)[0] : 0;
  const version = Number(value);
  return Number.isFinite(version) ? version : 0;
};

export const pendingMigrations = (
  currentVersion: number,
  migrations: readonly Migration[] = MIGRATIONS,
): readonly Migration[] =>
  [...migrations]
    .filter(migration => migration.version > currentVersion)
    .sort((a, b) => a.version - b.version);

export const runMigrations = async (
  db: DB,
  migrations: readonly Migration[] = MIGRATIONS,
): Promise<number> => {
  assertMigrationsAreWellFormed(migrations);

  let currentVersion = await readSchemaVersion(db);
  const pending = pendingMigrations(currentVersion, migrations);

  for (const migration of pending) {
    if (migration.version !== currentVersion + 1) {
      throw new Error(
        `Migration gap detected: database is at version ${currentVersion} but the next migration is ${migration.version} ("${migration.name}"). Migrations must be contiguous.`,
      );
    }

    try {
      await db.transaction(async tx => {
        await migration.up(tx);
        await tx.execute(`PRAGMA user_version = ${migration.version}`);
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Migration ${migration.version} ("${migration.name}") failed and was rolled back: ${reason}`,
      );
    }

    const applied = await readSchemaVersion(db);
    if (applied !== migration.version) {
      throw new Error(
        `Migration ${migration.version} ("${migration.name}") did not advance the schema version (still ${applied}).`,
      );
    }

    currentVersion = applied;
  }

  return currentVersion;
};
