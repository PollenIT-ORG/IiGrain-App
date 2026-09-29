/* global Atomics, SharedArrayBuffer */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const WORKER = process.env.JEST_WORKER_ID || '0';
const INSTANCE = `${process.pid}-${Date.now().toString(36)}-${Math.random()
  .toString(36)
  .slice(2, 10)}`;
const ROOT = path.join(
  os.tmpdir(),
  'iigrain-jest-sqlite',
  `worker-${WORKER}`,
  INSTANCE,
);

const ANDROID_DATABASE_PATH = path.join(ROOT, 'android-databases');
const ANDROID_FILES_PATH = path.join(ROOT, 'android-files');
const ANDROID_EXTERNAL_FILES_PATH = path.join(ROOT, 'android-external');
const IOS_DOCUMENT_PATH = path.join(ROOT, 'ios-documents');
const IOS_LIBRARY_PATH = path.join(ROOT, 'ios-library');

const RETURNS_ROWS = /^\s*(select|pragma|with|explain|values)\b/i;

const removeWithRetry = target => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      fs.rmSync(target, { force: true });
      return;
    } catch (error) {
      if (error && (error.code === 'EPERM' || error.code === 'EBUSY')) {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
        continue;
      }
      throw error;
    }
  }
  throw new Error(`Could not remove ${target} after repeated attempts.`);
};

const toPlainRow = row => {
  const plain = {};
  for (const key of Object.keys(row)) {
    const value = row[key];
    plain[key] = typeof value === 'bigint' ? Number(value) : value;
  }
  return plain;
};

const createHandle = filePath => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const raw = new DatabaseSync(filePath);
  let open = true;

  const executeSync = (query, params = []) => {
    if (!open) {
      throw new Error('Database is closed.');
    }
    const bound = params.map(value => (value === undefined ? null : value));

    if (RETURNS_ROWS.test(query)) {
      const rows = raw.prepare(query).all(...bound).map(toPlainRow);
      return { rows, rowsAffected: 0, insertId: undefined };
    }

    const result = raw.prepare(query).run(...bound);
    return {
      rows: [],
      rowsAffected: Number(result.changes ?? 0),
      insertId:
        result.lastInsertRowid === undefined
          ? undefined
          : Number(result.lastInsertRowid),
    };
  };

  const execute = async (query, params) => executeSync(query, params);

  const handle = {
    execute,
    executeSync,
    executeBatch: async commands => {
      for (const [query, params] of commands) {
        await execute(query, params);
      }
      return { rowsAffected: 0 };
    },
    transaction: async fn => {
      executeSync('BEGIN');
      try {
        await fn({ execute, executeSync, commit: async () => {}, rollback: async () => {} });
        executeSync('COMMIT');
      } catch (error) {
        try {
          executeSync('ROLLBACK');
        } catch {
          throw error;
        }
        throw error;
      }
    },
    isOpen: () => open,
    close: () => {
      if (open) {
        open = false;
        raw.close();
      }
    },
    closeAsync: async () => {
      handle.close();
    },
    delete: () => {
      handle.close();
      for (const suffix of ['', '-wal', '-shm']) {
        removeWithRetry(`${filePath}${suffix}`);
      }
    },
    attach: () => {},
    detach: () => {},
  };

  return handle;
};

const openHandles = new Map();

const open = ({ name, location }) => {
  if (name === ':memory:' || location === ':memory:') {
    return createHandle(':memory:');
  }
  const dir = location || ANDROID_DATABASE_PATH;
  const filePath = path.join(dir, name);
  const cached = openHandles.get(filePath);
  if (cached && cached.isOpen()) {
    return cached;
  }
  const handle = createHandle(filePath);
  openHandles.set(filePath, handle);
  return handle;
};

module.exports = {
  open,
  openAsync: async params => open(params),
  isSQLCipher: () => false,
  isLibsql: () => false,
  isTurso: () => false,
  isIOSEmbedded: () => false,
  ANDROID_DATABASE_PATH,
  ANDROID_FILES_PATH,
  ANDROID_EXTERNAL_FILES_PATH,
  IOS_DOCUMENT_PATH,
  IOS_LIBRARY_PATH,
};
