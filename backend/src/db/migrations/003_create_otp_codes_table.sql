-- 003_create_otp_codes_table.sql
-- Short-lived OTP codes for passwordless / email-verification login.
-- A new code is inserted on each request; verification checks the latest
-- unconsumed, unexpired code for that email.

CREATE TABLE IF NOT EXISTS otp_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       VARCHAR(255) NOT NULL,
  code        VARCHAR(10) NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- We always query the newest active code for an email.
CREATE INDEX IF NOT EXISTS idx_otp_codes_email_created
  ON otp_codes (email, created_at DESC);
