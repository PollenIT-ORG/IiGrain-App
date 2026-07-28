import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pool from "./pool.js";
import logger from "../utils/logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "migrations");

export async function runMigrations(): Promise<void> {
  logger.info("🔧 DB_SYNC enabled - checking for pending migrations...");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id          SERIAL PRIMARY KEY,
      filename    VARCHAR(255) NOT NULL UNIQUE,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  const allFiles = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const { rows } = await pool.query<{ filename: string }>(
    "SELECT filename FROM _migrations;"
  );
  const applied = new Set(rows.map((r) => r.filename));

  const pending = allFiles.filter((f) => !applied.has(f));

  if (pending.length === 0) {
    logger.info("✅ No pending migrations - schema is up to date.");
    return;
  }

  logger.info(`Found ${pending.length} pending migration(s).`);

  for (const file of pending) {
    const sql = await readFile(join(MIGRATIONS_DIR, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query(
        "INSERT INTO _migrations (filename) VALUES ($1);",
        [file]
      );
      await client.query("COMMIT");
      logger.info(`   ✅ Applied: ${file}`);
    } catch (err) {
      await client.query("ROLLBACK");
      logger.error(`   ❌ Failed: ${file} - rolled back.`, err);
      throw err;
    } finally {
      client.release();
    }
  }

  logger.info("✅ All pending migrations applied.");
}
