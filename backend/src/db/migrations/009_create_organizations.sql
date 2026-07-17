-- 009_create_organizations.sql
-- Organizations + a nullable org_id on users (a user belongs to one org).

CREATE TABLE IF NOT EXISTS organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(150) NOT NULL,
  code        VARCHAR(50) NOT NULL,          -- short unique code, e.g. "ORG-001"
  description TEXT,
  contact_email VARCHAR(255),
  contact_phone VARCHAR(20),
  address     TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

-- Code is unique among live organizations only (so a deleted org frees its code).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_org_code_alive
  ON organizations (LOWER(code)) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_org_alive
  ON organizations (id) WHERE deleted_at IS NULL;

-- Link a user to one organization (nullable: not every user has an org).
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_users_org_id ON users (org_id);
