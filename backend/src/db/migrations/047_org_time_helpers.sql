-- Every timestamp is stored as an absolute instant (timestamptz), which is
-- right: the moment does not change when the organization changes timezone.
-- What does change is the day a moment belongs to. A survey submitted at
-- 8 PM Central is already "tomorrow" in UTC, so grouping and comparing on the
-- raw column put it in the wrong day and the wrong month on the dashboard.
--
-- These helpers read the timezone the platform team set in settings, so every
-- query that groups by day or compares against today follows that setting,
-- including for rows that were written long before it was set. Change the
-- timezone in settings and the same rows regroup on the next read - nothing
-- has to be rewritten.

CREATE OR REPLACE FUNCTION org_timezone() RETURNS text AS $$
  SELECT COALESCE(
    (SELECT timezone
       FROM organizations
      WHERE deleted_at IS NULL
      ORDER BY created_at ASC
      LIMIT 1),
    'America/Chicago');
$$ LANGUAGE sql STABLE;

-- An instant as the wall clock reads it here.
CREATE OR REPLACE FUNCTION org_local(ts timestamptz) RETURNS timestamp AS $$
  SELECT ts AT TIME ZONE org_timezone();
$$ LANGUAGE sql STABLE;

-- Now, on that same wall clock.
CREATE OR REPLACE FUNCTION org_now() RETURNS timestamp AS $$
  SELECT now() AT TIME ZONE org_timezone();
$$ LANGUAGE sql STABLE;

-- Today, on that same wall clock. Use instead of CURRENT_DATE.
CREATE OR REPLACE FUNCTION org_today() RETURNS date AS $$
  SELECT (now() AT TIME ZONE org_timezone())::date;
$$ LANGUAGE sql STABLE;

-- Anything that still renders a timestamp without going through the helpers
-- above - a psql session, a report tool - should read the same clock, so the
-- database default follows the setting too. Skipped without complaint where
-- the connecting user may not alter the database.
DO $$
BEGIN
  EXECUTE format('ALTER DATABASE %I SET timezone TO %L',
                 current_database(), org_timezone());
EXCEPTION
  WHEN insufficient_privilege THEN NULL;
  WHEN OTHERS THEN NULL;
END $$;
