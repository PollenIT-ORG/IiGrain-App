-- 004_create_login_logs_table.sql
-- Audit trail of every login attempt (success or failure).
-- user_id is nullable: a failed attempt for an unknown email has no user.
-- We do NOT cascade-delete logs when a user is removed (keep the audit trail),
-- so the FK uses ON DELETE SET NULL.

CREATE TABLE IF NOT EXISTS login_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  email       VARCHAR(255) NOT NULL,
  method      VARCHAR(20) NOT NULL,   -- 'password' | 'otp'
  status      VARCHAR(20) NOT NULL,   -- 'success' | 'failed'
  ip_address  VARCHAR(64),
  user_agent  TEXT,
  reason      TEXT,                   -- failure reason, e.g. 'invalid_password'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_logs_user_id ON login_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_login_logs_email   ON login_logs (email);
