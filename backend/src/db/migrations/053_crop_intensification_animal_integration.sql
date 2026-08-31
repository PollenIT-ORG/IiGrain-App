-- The last two practices from the worksheet. Field scoped, no program.

CREATE TABLE IF NOT EXISTS field_crop_intensifications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id          UUID NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  status            VARCHAR(20) NOT NULL DEFAULT 'in_progress',
  event_date        DATE,
  zone              VARCHAR(10),
  in_use            BOOLEAN,
  crops_per_period  NUMERIC(5, 2),
  period_years      NUMERIC(5, 2),
  fallow_eliminated BOOLEAN,
  notes             TEXT,
  created_by        UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ,
  CONSTRAINT ck_field_crop_intensifications_status
    CHECK (status IN ('in_progress', 'completed')),
  CONSTRAINT ck_field_crop_intensifications_zone
    CHECK (zone IS NULL OR zone IN ('1', '2', '3'))
);

CREATE TABLE IF NOT EXISTS field_animal_integrations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id            UUID NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  status              VARCHAR(20) NOT NULL DEFAULT 'in_progress',
  event_date          DATE,
  animal_breed        VARCHAR(150),
  grazing_period      VARCHAR(100),
  biomass_foraged_pct NUMERIC(6, 2),
  notes               TEXT,
  created_by          UUID REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ,
  CONSTRAINT ck_field_animal_integrations_status
    CHECK (status IN ('in_progress', 'completed'))
);

CREATE INDEX IF NOT EXISTS idx_field_crop_intensifications_field
  ON field_crop_intensifications (field_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_field_animal_integrations_field
  ON field_animal_integrations (field_id) WHERE deleted_at IS NULL;
