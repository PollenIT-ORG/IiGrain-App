import { ANDROID_DATABASE_PATH, open } from '@op-engineering/op-sqlite';
import {
  DATABASE_NAME,
  LATEST_SCHEMA_VERSION,
  closeDatabase,
  databaseLocation,
  getDatabase,
  getDatabaseStatus,
  getSchemaVersion,
  initializeDatabase,
  isDatabaseReady,
  runTransaction,
} from '../src/services/db';
import {
  MIGRATIONS,
  pendingMigrations,
  readSchemaVersion,
  runMigrations,
} from '../src/services/db/migrations';
import { runTransactionOn } from '../src/services/db/transaction';
import { asOwnerUserId } from '../src/services/db/types';
import type { DB, Migration } from '../src/services/db/types';

const removeDatabaseFiles = (): void => {
  open({ name: DATABASE_NAME, location: databaseLocation() }).delete();
};

const nowIso = (): string => new Date().toISOString();

const insertUser = async (localId: string, email: string): Promise<void> => {
  await getDatabase().execute(
    `INSERT INTO users (local_id, server_id, email, name, role, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [localId, null, email, 'Test User', 'farmer', nowIso(), nowIso()],
  );
};

const enqueue = async (
  ownerUserId: string,
  idempotencyKey: string,
  entityLocalId = 'entity-1',
): Promise<void> => {
  await getDatabase().execute(
    `INSERT INTO sync_queue
       (owner_user_id, entity_type, entity_local_id, entity_server_id, operation,
        payload_json, idempotency_key, status, attempt_count, available_at,
        created_at, updated_at, last_error)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      ownerUserId,
      'farm',
      entityLocalId,
      null,
      'create',
      JSON.stringify({ name: 'Test Farm' }),
      idempotencyKey,
      'pending',
      0,
      nowIso(),
      nowIso(),
      nowIso(),
      null,
    ],
  );
};

const countOf = async (sql: string, params: unknown[] = []): Promise<number> => {
  const result = await getDatabase().execute(sql, params as never[]);
  const row = result.rows[0];
  return row ? Number(Object.values(row)[0]) : 0;
};

beforeEach(async () => {
  await closeDatabase();
  removeDatabaseFiles();
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(async () => {
  await closeDatabase();
  removeDatabaseFiles();
});

describe('database connection', () => {
  it('opens and reports a healthy status', async () => {
    const status = await initializeDatabase();

    expect(isDatabaseReady()).toBe(true);
    expect(status.name).toBe('iigrain.sqlite');
    expect(status.schemaVersion).toBe(LATEST_SCHEMA_VERSION);
    expect(status.sqliteVersion).not.toBe('unknown');
  });

  it('enables WAL journal mode', async () => {
    const status = await initializeDatabase();
    expect(status.journalMode).toBe('wal');

    const verified = await getDatabase().execute('PRAGMA journal_mode');
    expect(String(Object.values(verified.rows[0])[0]).toLowerCase()).toBe('wal');
  });

  it('enables foreign key enforcement', async () => {
    const status = await initializeDatabase();
    expect(status.foreignKeys).toBe(true);

    const verified = await getDatabase().execute('PRAGMA foreign_keys');
    expect(Number(Object.values(verified.rows[0])[0])).toBe(1);
  });

  it('reuses a single connection across concurrent initialization', async () => {
    const [a, b, c] = await Promise.all([
      initializeDatabase(),
      initializeDatabase(),
      initializeDatabase(),
    ]);

    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('throws when the database is used before initialization', async () => {
    expect(() => getDatabase()).toThrow(/not initialized/i);
  });

  it('reopens successfully after close', async () => {
    await initializeDatabase();
    await closeDatabase();

    expect(isDatabaseReady()).toBe(false);
    expect(getDatabaseStatus()).toBeNull();

    const status = await initializeDatabase();
    expect(status.schemaVersion).toBe(LATEST_SCHEMA_VERSION);
  });
});

describe('migrations', () => {
  it('brings a fresh database to the latest version', async () => {
    await initializeDatabase();
    await expect(getSchemaVersion()).resolves.toBe(LATEST_SCHEMA_VERSION);
  });

  it('creates every foundation table', async () => {
    await initializeDatabase();

    for (const table of ['app_meta', 'users', 'sync_state', 'sync_queue']) {
      const count = await countOf(
        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?",
        [table],
      );
      expect(count).toBe(1);
    }
  });

  it('creates the sync_queue indexes', async () => {
    await initializeDatabase();

    for (const index of [
      'idx_sync_queue_owner',
      'idx_sync_queue_status',
      'idx_sync_queue_available_at',
      'idx_sync_queue_claim',
      'idx_sync_queue_entity',
    ]) {
      const count = await countOf(
        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name = ?",
        [index],
      );
      expect(count).toBe(1);
    }
  });

  it('does not re-run an applied migration', async () => {
    await initializeDatabase();
    const db = getDatabase();

    let runs = 0;
    const counted: Migration[] = [
      {
        version: 1,
        name: 'already_applied',
        up: async () => {
          runs += 1;
        },
      },
    ];

    await runMigrations(db, counted);
    expect(runs).toBe(0);
  });

  it('executes pending migrations in ascending order', async () => {
    const order: number[] = [];
    const db: DB = open({ name: 'ordering.sqlite', location: ANDROID_DATABASE_PATH });

    const migrations: Migration[] = [
      {
        version: 2,
        name: 'second',
        up: async () => {
          order.push(2);
        },
      },
      {
        version: 1,
        name: 'first',
        up: async () => {
          order.push(1);
        },
      },
      {
        version: 3,
        name: 'third',
        up: async () => {
          order.push(3);
        },
      },
    ];

    const finalVersion = await runMigrations(db, migrations);

    expect(order).toEqual([1, 2, 3]);
    expect(finalVersion).toBe(3);
    db.delete();
  });

  it('selects only versions greater than the current one', () => {
    const migrations: Migration[] = [
      { version: 1, name: 'a', up: async () => {} },
      { version: 2, name: 'b', up: async () => {} },
      { version: 3, name: 'c', up: async () => {} },
    ];

    expect(pendingMigrations(1, migrations).map(m => m.version)).toEqual([2, 3]);
    expect(pendingMigrations(3, migrations)).toHaveLength(0);
  });

  it('does not advance the schema version when a migration fails', async () => {
    const db: DB = open({ name: 'failing.sqlite', location: ANDROID_DATABASE_PATH });

    const migrations: Migration[] = [
      {
        version: 1,
        name: 'creates_table',
        up: async tx => {
          await tx.execute('CREATE TABLE survivor (id INTEGER PRIMARY KEY)');
        },
      },
      {
        version: 2,
        name: 'explodes',
        up: async tx => {
          await tx.execute('CREATE TABLE doomed (id INTEGER PRIMARY KEY)');
          throw new Error('migration exploded');
        },
      },
    ];

    await expect(runMigrations(db, migrations)).rejects.toThrow(/migration exploded/);

    await expect(readSchemaVersion(db)).resolves.toBe(1);

    const survivor = await db.execute(
      "SELECT COUNT(*) AS c FROM sqlite_master WHERE type = 'table' AND name = 'survivor'",
    );
    expect(Number(survivor.rows[0].c)).toBe(1);

    const doomed = await db.execute(
      "SELECT COUNT(*) AS c FROM sqlite_master WHERE type = 'table' AND name = 'doomed'",
    );
    expect(Number(doomed.rows[0].c)).toBe(0);

    db.delete();
  });

  it('rejects a non-contiguous migration set', async () => {
    const db: DB = open({ name: 'gap.sqlite', location: ANDROID_DATABASE_PATH });

    const migrations: Migration[] = [
      { version: 2, name: 'skips_one', up: async () => {} },
    ];

    await expect(runMigrations(db, migrations)).rejects.toThrow(/gap/i);
    db.delete();
  });

  it('rejects duplicate migration versions', async () => {
    const db: DB = open({ name: 'dupe.sqlite', location: ANDROID_DATABASE_PATH });

    const migrations: Migration[] = [
      { version: 1, name: 'a', up: async () => {} },
      { version: 1, name: 'b', up: async () => {} },
    ];

    await expect(runMigrations(db, migrations)).rejects.toThrow(/duplicate/i);
    db.delete();
  });

  it('ships contiguous migrations starting at version 1', () => {
    expect(MIGRATIONS.length).toBeGreaterThan(0);
    MIGRATIONS.forEach((migration, index) => {
      expect(migration.version).toBe(index + 1);
    });
    expect(LATEST_SCHEMA_VERSION).toBe(MIGRATIONS.length);
  });
});

describe('transactions', () => {
  it('commits every write on success', async () => {
    await initializeDatabase();

    await runTransaction(async tx => {
      await tx.execute(
        `INSERT INTO users (local_id, server_id, email, name, role, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['user-a', null, 'a@example.com', 'A', 'farmer', nowIso(), nowIso()],
      );
      await tx.execute(
        `INSERT INTO users (local_id, server_id, email, name, role, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['user-b', null, 'b@example.com', 'B', 'assessor', nowIso(), nowIso()],
      );
    });

    await expect(countOf('SELECT COUNT(*) FROM users')).resolves.toBe(2);
  });

  it('rolls back every write when the callback throws', async () => {
    await initializeDatabase();

    await expect(
      runTransaction(async tx => {
        await tx.execute(
          `INSERT INTO users (local_id, server_id, email, name, role, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          ['rollback-1', null, 'r1@example.com', 'R1', 'farmer', nowIso(), nowIso()],
        );
        await tx.execute(
          `INSERT INTO users (local_id, server_id, email, name, role, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          ['rollback-2', null, 'r2@example.com', 'R2', 'farmer', nowIso(), nowIso()],
        );
        throw new Error('deliberate failure');
      }),
    ).rejects.toThrow('deliberate failure');

    await expect(countOf('SELECT COUNT(*) FROM users')).resolves.toBe(0);
  });

  it('preserves the original error instance', async () => {
    await initializeDatabase();
    const original = new Error('original cause');

    await expect(
      runTransaction(async () => {
        throw original;
      }),
    ).rejects.toBe(original);
  });

  it('returns the callback result', async () => {
    await initializeDatabase();

    const result = await runTransactionOn(getDatabase(), async () => 'done');
    expect(result).toBe('done');
  });

  it('commits a domain row and its queue entry atomically', async () => {
    await initializeDatabase();
    await insertUser('owner-atomic', 'atomic@example.com');

    await expect(
      runTransaction(async tx => {
        await tx.execute(
          `INSERT INTO app_meta (key, value, updated_at) VALUES (?, ?, ?)`,
          ['pending-write', 'value', nowIso()],
        );
        await tx.execute(
          `INSERT INTO sync_queue
             (owner_user_id, entity_type, entity_local_id, operation,
              idempotency_key, status, attempt_count, available_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            'owner-atomic',
            'farm',
            'farm-1',
            'create',
            'key-atomic',
            'pending',
            0,
            nowIso(),
            nowIso(),
            nowIso(),
          ],
        );
        throw new Error('abort after both writes');
      }),
    ).rejects.toThrow('abort after both writes');

    await expect(
      countOf('SELECT COUNT(*) FROM app_meta WHERE key = ?', ['pending-write']),
    ).resolves.toBe(0);
    await expect(countOf('SELECT COUNT(*) FROM sync_queue')).resolves.toBe(0);
  });
});

describe('ownership isolation', () => {
  it('rejects an empty owner id at the type boundary', () => {
    expect(() => asOwnerUserId('   ')).toThrow(/non-empty/i);
    expect(asOwnerUserId(' user-a ')).toBe('user-a');
  });

  it('keeps two users’ queue entries separate', async () => {
    await initializeDatabase();
    await insertUser('user-a', 'a@example.com');
    await insertUser('user-b', 'b@example.com');

    await enqueue('user-a', 'key-a1');
    await enqueue('user-a', 'key-a2');
    await enqueue('user-b', 'key-b1');

    await expect(
      countOf('SELECT COUNT(*) FROM sync_queue WHERE owner_user_id = ?', ['user-a']),
    ).resolves.toBe(2);
    await expect(
      countOf('SELECT COUNT(*) FROM sync_queue WHERE owner_user_id = ?', ['user-b']),
    ).resolves.toBe(1);
    await expect(countOf('SELECT COUNT(*) FROM sync_queue')).resolves.toBe(3);
  });

  it('refuses queue rows for an unknown owner', async () => {
    await initializeDatabase();

    await expect(enqueue('ghost-user', 'key-ghost')).rejects.toThrow();
    await expect(countOf('SELECT COUNT(*) FROM sync_queue')).resolves.toBe(0);
  });

  it('refuses sync_state rows for an unknown owner', async () => {
    await initializeDatabase();

    await expect(
      getDatabase().execute(
        `INSERT INTO sync_state (owner_user_id, status, updated_at) VALUES (?, ?, ?)`,
        ['ghost-user', 'pending', nowIso()],
      ),
    ).rejects.toThrow();
  });

  it('removes a user’s rows when the user is deleted', async () => {
    await initializeDatabase();
    await insertUser('user-a', 'a@example.com');
    await insertUser('user-b', 'b@example.com');
    await enqueue('user-a', 'key-a1');
    await enqueue('user-b', 'key-b1');

    await getDatabase().execute('DELETE FROM users WHERE local_id = ?', ['user-a']);

    await expect(countOf('SELECT COUNT(*) FROM sync_queue')).resolves.toBe(1);
    await expect(
      countOf('SELECT COUNT(*) FROM sync_queue WHERE owner_user_id = ?', ['user-b']),
    ).resolves.toBe(1);
  });
});

describe('sync queue', () => {
  it('inserts an entry with its defaults', async () => {
    await initializeDatabase();
    await insertUser('owner-1', 'owner1@example.com');
    await enqueue('owner-1', 'key-1');

    const result = await getDatabase().execute(
      'SELECT status, attempt_count, last_error FROM sync_queue WHERE idempotency_key = ?',
      ['key-1'],
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].status).toBe('pending');
    expect(Number(result.rows[0].attempt_count)).toBe(0);
    expect(result.rows[0].last_error).toBeNull();
  });

  it('enforces a unique idempotency key', async () => {
    await initializeDatabase();
    await insertUser('owner-1', 'owner1@example.com');

    await enqueue('owner-1', 'duplicate-key');
    await expect(enqueue('owner-1', 'duplicate-key', 'entity-2')).rejects.toThrow();

    await expect(countOf('SELECT COUNT(*) FROM sync_queue')).resolves.toBe(1);
  });

  it('updates status and attempt count', async () => {
    await initializeDatabase();
    await insertUser('owner-1', 'owner1@example.com');
    await enqueue('owner-1', 'key-1');

    await getDatabase().execute(
      `UPDATE sync_queue
          SET status = ?, attempt_count = attempt_count + 1, last_error = ?, updated_at = ?
        WHERE idempotency_key = ?`,
      ['failed', 'network unreachable', nowIso(), 'key-1'],
    );

    const result = await getDatabase().execute(
      'SELECT status, attempt_count, last_error FROM sync_queue WHERE idempotency_key = ?',
      ['key-1'],
    );

    expect(result.rows[0].status).toBe('failed');
    expect(Number(result.rows[0].attempt_count)).toBe(1);
    expect(result.rows[0].last_error).toBe('network unreachable');
  });

  it('rejects an unknown status', async () => {
    await initializeDatabase();
    await insertUser('owner-1', 'owner1@example.com');
    await enqueue('owner-1', 'key-1');

    await expect(
      getDatabase().execute('UPDATE sync_queue SET status = ? WHERE idempotency_key = ?', [
        'not-a-status',
        'key-1',
      ]),
    ).rejects.toThrow();
  });

  it('rejects an unknown operation', async () => {
    await initializeDatabase();
    await insertUser('owner-1', 'owner1@example.com');

    await expect(
      getDatabase().execute(
        `INSERT INTO sync_queue
           (owner_user_id, entity_type, entity_local_id, operation,
            idempotency_key, status, attempt_count, available_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'owner-1',
          'farm',
          'farm-1',
          'upsert',
          'key-bad-op',
          'pending',
          0,
          nowIso(),
          nowIso(),
          nowIso(),
        ],
      ),
    ).rejects.toThrow();
  });

  it('finds claimable work by owner, status and availability', async () => {
    await initializeDatabase();
    await insertUser('owner-1', 'owner1@example.com');

    const past = new Date(Date.now() - 60_000).toISOString();
    const future = new Date(Date.now() + 600_000).toISOString();

    await getDatabase().execute(
      `INSERT INTO sync_queue
         (owner_user_id, entity_type, entity_local_id, operation,
          idempotency_key, status, attempt_count, available_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['owner-1', 'farm', 'f1', 'create', 'ready', 'pending', 0, past, nowIso(), nowIso()],
    );
    await getDatabase().execute(
      `INSERT INTO sync_queue
         (owner_user_id, entity_type, entity_local_id, operation,
          idempotency_key, status, attempt_count, available_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['owner-1', 'farm', 'f2', 'create', 'backoff', 'pending', 2, future, nowIso(), nowIso()],
    );

    const claimable = await getDatabase().execute(
      `SELECT idempotency_key FROM sync_queue
        WHERE owner_user_id = ? AND status = ? AND available_at <= ?
        ORDER BY id`,
      ['owner-1', 'pending', nowIso()],
    );

    expect(claimable.rows.map(row => row.idempotency_key)).toEqual(['ready']);
  });
});

describe('persistence', () => {
  it('retains data across close and reopen', async () => {
    await initializeDatabase();
    await insertUser('persisted-user', 'persist@example.com');
    await getDatabase().execute(
      'INSERT INTO app_meta (key, value, updated_at) VALUES (?, ?, ?)',
      ['marker', 'survives-restart', nowIso()],
    );
    await enqueue('persisted-user', 'persisted-key');

    await closeDatabase();
    expect(isDatabaseReady()).toBe(false);

    const status = await initializeDatabase();
    expect(status.schemaVersion).toBe(LATEST_SCHEMA_VERSION);

    const marker = await getDatabase().execute(
      'SELECT value FROM app_meta WHERE key = ?',
      ['marker'],
    );
    expect(marker.rows[0].value).toBe('survives-restart');

    await expect(countOf('SELECT COUNT(*) FROM users')).resolves.toBe(1);
    await expect(countOf('SELECT COUNT(*) FROM sync_queue')).resolves.toBe(1);
  });

  it('does not re-run migrations on reopen', async () => {
    await initializeDatabase();
    await getDatabase().execute(
      'INSERT INTO app_meta (key, value, updated_at) VALUES (?, ?, ?)',
      ['untouched', 'still-here', nowIso()],
    );

    await closeDatabase();
    await initializeDatabase();

    const rows = await getDatabase().execute(
      'SELECT value FROM app_meta WHERE key = ?',
      ['untouched'],
    );
    expect(rows.rows[0].value).toBe('still-here');
    await expect(getSchemaVersion()).resolves.toBe(LATEST_SCHEMA_VERSION);
  });
});

describe('initialization recovers after a failure', () => {
  it('can be retried once a transient open failure clears', async () => {
    const opSqlite = require('@op-engineering/op-sqlite');
    const realOpen = opSqlite.open;
    let failNext = true;
    const spy = jest.spyOn(opSqlite, 'open');
    spy.mockImplementation(((params: { name: string; location?: string }) => {
      if (failNext) {
        failNext = false;
        throw new Error('unable to open database file');
      }
      return realOpen(params);
    }) as unknown as typeof opSqlite.open);

    await expect(initializeDatabase()).rejects.toThrow(/unable to open/i);
    expect(isDatabaseReady()).toBe(false);

    const status = await initializeDatabase();
    expect(status.schemaVersion).toBe(LATEST_SCHEMA_VERSION);
    expect(isDatabaseReady()).toBe(true);

    spy.mockRestore();
  });

  it('does not leave a half-initialized database usable', async () => {
    const opSqlite = require('@op-engineering/op-sqlite');
    const spy = jest.spyOn(opSqlite, 'open').mockImplementation(() => {
      throw new Error('locked');
    });

    await expect(initializeDatabase()).rejects.toThrow(/locked/);
    expect(() => getDatabase()).toThrow(/not initialized/i);

    spy.mockRestore();
  });
});
