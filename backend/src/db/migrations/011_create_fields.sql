-- 011_create_fields.sql
-- Fields (plots) within a farm. Each field belongs to exactly one farm.
-- A farmer can add fields to their own farms; admin can manage all.

CREATE TABLE IF NOT EXISTS fields (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id         UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  name            VARCHAR(150) NOT NULL,
  area_acres      NUMERIC(10, 2),          -- field area (subset of farm area)
  crop            VARCHAR(100),            -- current crop
  season          VARCHAR(100),            -- e.g. "Kharif 2024"
  irrigation      VARCHAR(100),            -- e.g. "Drip", "Sprinkler", "Rain-fed"
  location        TEXT,                    -- GPS coords or description
  sowing_date     DATE,
  expected_harvest DATE,
  status          VARCHAR(20) NOT NULL DEFAULT 'healthy'
                    CHECK (status IN ('healthy', 'monitor', 'critical')),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_fields_farm_id ON fields (farm_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_fields_alive   ON fields (id)      WHERE deleted_at IS NULL;
