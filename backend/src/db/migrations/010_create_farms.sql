-- 010_create_farms.sql
-- Farms. Each farm has an owner (a farmer user) and optionally belongs to an
-- organization. Soft-deletable (deleted_at).

CREATE TABLE IF NOT EXISTS farms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(150) NOT NULL,
  area_acres  NUMERIC(10, 2),               -- farm size in acres
  location    TEXT,                          -- address / area description
  owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- the farmer
  org_id      UUID REFERENCES organizations(id) ON DELETE SET NULL,  -- optional
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_farms_alive    ON farms (id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_farms_owner_id ON farms (owner_id);
CREATE INDEX IF NOT EXISTS idx_farms_org_id   ON farms (org_id);
