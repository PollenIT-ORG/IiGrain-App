-- 008_recreate_refresh_tokens_table.sql
-- Re-introduces the refresh_tokens table (dropped in 007). Each successful
-- login/verify-otp issues a refresh token (plain string) stored here.
-- /auth/refresh-token validates against this table to mint a new short-lived
-- access token, and /auth/logout deletes the row so the token can't be reused.

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       VARCHAR(255) NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast lookups by token (on refresh/logout) and by user (revoke-all).
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token   ON refresh_tokens (token);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens (user_id);
