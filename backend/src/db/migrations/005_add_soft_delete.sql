-- 005_add_soft_delete.sql
-- Adds soft-delete ("paranoid") support to all tables. Instead of physically
-- removing a row, delete APIs set deleted_at = now(). A row with deleted_at IS
-- NULL is "alive"; a non-null deleted_at means it's been soft-deleted.
--
-- Partial indexes (WHERE deleted_at IS NULL) keep lookups on live rows fast,
-- since almost every query filters to live rows.

ALTER TABLE roles       ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE users       ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE otp_codes   ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE login_logs  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Indexes over only the live rows (the common case).
CREATE INDEX IF NOT EXISTS idx_roles_alive
  ON roles (id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_alive
  ON users (id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_otp_codes_alive
  ON otp_codes (id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_login_logs_alive
  ON login_logs (id) WHERE deleted_at IS NULL;

-- The users.email UNIQUE constraint applies to ALL rows including soft-deleted
-- ones, which would block re-registering an email after its user is soft-deleted.
-- Replace the table-wide unique with a partial unique index over live rows only,
-- so a soft-deleted email frees up for reuse while live emails stay unique.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_users_email_alive
  ON users (LOWER(email)) WHERE deleted_at IS NULL;
