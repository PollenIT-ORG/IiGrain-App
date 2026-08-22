import prisma from "../db/prisma.js";
import logger from "../utils/logger.js";
import { clearClockCache, getClock, type Clock } from "../utils/datetime.js";

/**
 * Puts the timezone and clock chosen in settings into effect everywhere.
 *
 * It runs on its own the moment the setting is saved from the admin panel, and
 * can also be run by hand with `npm run db:clock`.
 *
 * Nothing is rewritten. Every timestamp is stored as an absolute instant, so
 * the moment a farmer submitted does not move because the office changed
 * timezone - what changes is the day and time it reads as. That comes from
 * this setting: the panel and the emails format with it, and in the database
 * org_timezone() / org_local() / org_now() / org_today() read it, which is
 * what every query that groups by month or compares against today now uses.
 * Rows written years ago follow along on the next read, which is why there is
 * nothing to backfill.
 */

export interface ClockSample {
  table: string;
  column: string;
  rows: number;
  oldest: string | null;
  newest: string | null;
}

export interface ClockApplied {
  clock: Clock;
  /** Today's date on that clock, as the database now counts it. */
  today: string;
  /** True when the database's own default timezone could be set as well. */
  databaseDefaultSet: boolean;
  samples: ClockSample[];
}

// Enough of the record to show that existing data reads correctly. Names are
// fixed here, never taken from a request, so they are safe to interpolate.
const SAMPLE_COLUMNS: Array<{ table: string; column: string }> = [
  { table: "users", column: "created_at" },
  { table: "programs", column: "created_at" },
  { table: "program_enrollments", column: "enrolled_at" },
  { table: "field_assessments", column: "submitted_at" },
  { table: "program_admin_survey_submissions", column: "created_at" },
  { table: "user_login_logs", column: "created_at" },
];

async function setDatabaseDefault(): Promise<boolean> {
  try {
    // The timezone is read from the table inside the statement rather than
    // pasted in, so there is nothing to escape. A database this user may not
    // alter is not a failure: the helper functions above are what the queries
    // actually use.
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        EXECUTE format('ALTER DATABASE %I SET timezone TO %L',
                       current_database(), org_timezone());
      EXCEPTION
        WHEN OTHERS THEN NULL;
      END $$;`);
    return true;
  } catch (err) {
    logger.warn?.("Could not set the database default timezone.", err);
    return false;
  }
}

async function sample(
  table: string,
  column: string,
  format: Intl.DateTimeFormat
): Promise<ClockSample | null> {
  const exists = await prisma.$queryRawUnsafe<{ ok: boolean }[]>(
    "SELECT to_regclass($1) IS NOT NULL AS ok;",
    table
  );
  if (!exists[0]?.ok) return null;

  const rows = await prisma.$queryRawUnsafe<
    { oldest: Date | null; newest: Date | null; n: bigint }[]
  >(
    `SELECT MIN(${column}) AS oldest, MAX(${column}) AS newest,
            COUNT(${column}) AS n
       FROM ${table};`
  );
  const r = rows[0];
  if (!r) return null;
  return {
    table,
    column,
    rows: Number(r.n),
    oldest: r.oldest ? format.format(r.oldest) : null,
    newest: r.newest ? format.format(r.newest) : null,
  };
}

export async function applyClock(): Promise<ClockApplied> {
  // Read the setting fresh - it has usually just been saved.
  clearClockCache();
  const clock = await getClock();

  const databaseDefaultSet = await setDatabaseDefault();

  const format = new Intl.DateTimeFormat("en-US", {
    timeZone: clock.timezone,
    hour12: clock.hour12,
    dateStyle: "medium",
    timeStyle: "short",
  });

  const samples: ClockSample[] = [];
  for (const s of SAMPLE_COLUMNS) {
    try {
      const row = await sample(s.table, s.column, format);
      if (row) samples.push(row);
    } catch (err) {
      // A table this deployment does not have is not worth failing over.
      logger.debug?.(`Could not read ${s.table}.${s.column}`, err);
    }
  }

  const today = await prisma.$queryRawUnsafe<{ d: string }[]>(
    "SELECT org_today()::text AS d;"
  );

  return {
    clock,
    today: today[0]?.d ?? "",
    databaseDefaultSet,
    samples,
  };
}

/** One line for the log, so a change of setting leaves a trace. */
export function describeClock(applied: ClockApplied): string {
  const rows = applied.samples.reduce((n, s) => n + s.rows, 0);
  return (
    `Clock set to ${applied.clock.timezone}, ` +
    `${applied.clock.hour12 ? "12" : "24"} hour. ` +
    `Today is ${applied.today}; ${rows.toLocaleString()} existing records ` +
    "now read on this clock."
  );
}
