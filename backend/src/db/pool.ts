import pkg from "pg";
import type { PoolClient, QueryResult, QueryResultRow } from "pg";
import env from "../config/env.js";
import logger from "../utils/logger.js";

const { Pool } = pkg;

const connectionString = env.databaseUrl.replace(/[?&]sslmode=[^&]*/, "");

const dbSslEnv = process.env.DB_SSL;
const wantsSsl =
  dbSslEnv === "true"
    ? true
    : dbSslEnv === "false"
      ? false
      : /sslmode=require/.test(env.databaseUrl) ||
        /\.neon\.tech|\.aws\.neon|\.render\.com|\.supabase\.|\.pooler\./.test(
          env.databaseUrl
        );

const pool = new Pool({
  connectionString,
  ssl: wantsSsl ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on("error", (err) => {
  logger.error("Unexpected PostgreSQL pool error", err);
});

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

interface ConnectionCheckRow extends QueryResultRow {
  ok: number;
}

export async function checkConnection(): Promise<ConnectionCheckRow> {
  const result = await pool.query<ConnectionCheckRow>("SELECT 1 AS ok;");
  return result.rows[0];
}

export default pool;
