-- 002_create_users_table.sql
-- Application users. Each user has exactly one role (FK -> roles).
-- password_hash is nullable to allow OTP-only / passwordless users later.

-- pgcrypto provides gen_random_uuid() for UUID primary keys.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id            INTEGER NOT NULL REFERENCES roles(id),
  full_name          VARCHAR(150),
  email              VARCHAR(255) NOT NULL UNIQUE,
  phone              VARCHAR(20),
  password_hash      TEXT,
  is_active          BOOLEAN NOT NULL DEFAULT true,
  is_email_verified  BOOLEAN NOT NULL DEFAULT false,
  last_login_at      TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast lookups by email (login) and by role (admin listing/filtering).
CREATE INDEX IF NOT EXISTS idx_users_email   ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users (role_id);
