-- Field monitoring modules.
--
-- Every table here answers the same shape of question: what did this farmer do
-- on THIS field, for THIS program, on a given day. So they all carry the same
-- four anchors (field, program, status, who entered it) and then their own
-- columns on top.
--
-- A field holds many records per module: first training, second training, and
-- so on. Nothing here is one-per-field.
--
-- Status is deliberately simple for now. A record is either still being worked
-- on or it is done, and the module list counts the done ones. Tier, Bronze and
-- Silver are not part of this migration at all.

-- The four columns every module record shares. Written out per table rather
-- than inherited, so each table stays readable on its own.

-- 1. Training -------------------------------------------------------------
-- Kept per field rather than per farm: one farm can run different sessions for
-- different fields, and each field is harvested on its own terms.
CREATE TABLE IF NOT EXISTS field_trainings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id      UUID NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  program_id    UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  status        VARCHAR(20) NOT NULL DEFAULT 'in_progress',
  training_date DATE,
  topic         VARCHAR(200),
  organizer     VARCHAR(200),
  hours         NUMERIC(6, 2),
  notes         TEXT,
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ,
  CONSTRAINT ck_field_trainings_status
    CHECK (status IN ('in_progress', 'completed'))
);

-- 2. Soil samples ---------------------------------------------------------
-- One row per sampling point. The point exists as soon as it is placed on the
-- map; the lab values arrive later, which is why they are nullable. A point
-- with no sample_date is what the app shows as "Not sampled".
CREATE TABLE IF NOT EXISTS field_soil_samples (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id      UUID NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  program_id    UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  status        VARCHAR(20) NOT NULL DEFAULT 'in_progress',
  point_label   VARCHAR(60) NOT NULL,
  latitude      NUMERIC(9, 6),
  longitude     NUMERIC(9, 6),
  sample_date   DATE,
  soc_0_2       NUMERIC(8, 3),
  soc_2_6       NUMERIC(8, 3),
  was_0_2       NUMERIC(8, 3),
  soil_texture  VARCHAR(100),
  soil_series   VARCHAR(150),
  notes         TEXT,
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ,
  CONSTRAINT ck_field_soil_samples_status
    CHECK (status IN ('in_progress', 'completed'))
);

-- 3. Irrigation -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS field_irrigations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id          UUID NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  program_id        UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  status            VARCHAR(20) NOT NULL DEFAULT 'in_progress',
  irrigation_date   DATE,
  irrigation_type   VARCHAR(100),
  amount_inches     NUMERIC(8, 2),
  amount_gallons_ac NUMERIC(12, 2),
  source            VARCHAR(100),
  notes             TEXT,
  created_by        UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ,
  CONSTRAINT ck_field_irrigations_status
    CHECK (status IN ('in_progress', 'completed'))
);

-- 4. Pesticide use --------------------------------------------------------
CREATE TABLE IF NOT EXISTS field_pesticides (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id           UUID NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  program_id         UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  status             VARCHAR(20) NOT NULL DEFAULT 'in_progress',
  application_date   DATE,
  product            VARCHAR(200),
  product_type       VARCHAR(100),
  rate               NUMERIC(10, 3),
  rate_unit          VARCHAR(50),
  application_method VARCHAR(100),
  notes              TEXT,
  created_by         UUID REFERENCES users(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at         TIMESTAMPTZ,
  CONSTRAINT ck_field_pesticides_status
    CHECK (status IN ('in_progress', 'completed'))
);

-- 5. Synthetic fertilizer -------------------------------------------------
-- These are nutrients APPLIED to the field. Not to be confused with field_soil,
-- which holds what a lab found IN the ground. Two different things.
-- Percentages are stored in oxide form (P2O5, K2O) because that is how a
-- fertilizer bag is labelled and how the farmer will read it.
CREATE TABLE IF NOT EXISTS field_fertilizers (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id           UUID NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  program_id         UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  status             VARCHAR(20) NOT NULL DEFAULT 'in_progress',
  application_date   DATE,
  fertilizer_type    VARCHAR(150),
  form               VARCHAR(50),
  application_method VARCHAR(100),
  rate_lbs_acre      NUMERIC(10, 2),
  n_pct              NUMERIC(6, 2),
  p2o5_pct           NUMERIC(6, 2),
  k2o_pct            NUMERIC(6, 2),
  notes              TEXT,
  created_by         UUID REFERENCES users(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at         TIMESTAMPTZ,
  CONSTRAINT ck_field_fertilizers_status
    CHECK (status IN ('in_progress', 'completed'))
);

-- 6. Tillage --------------------------------------------------------------
-- residue_before_pct is not on the app form yet, but the worksheet asks for
-- residue before planting as well as after, so the column is here from the
-- start rather than needing a second migration later.
CREATE TABLE IF NOT EXISTS field_tillage_records (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id           UUID NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  program_id         UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  status             VARCHAR(20) NOT NULL DEFAULT 'in_progress',
  tillage_date       DATE,
  implement          VARCHAR(150),
  tillage_type       VARCHAR(100),
  depth_inches       NUMERIC(6, 2),
  residue_after_pct  NUMERIC(5, 2),
  residue_before_pct NUMERIC(5, 2),
  soil_moisture      VARCHAR(50),
  notes              TEXT,
  created_by         UUID REFERENCES users(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at         TIMESTAMPTZ,
  CONSTRAINT ck_field_tillage_status
    CHECK (status IN ('in_progress', 'completed'))
);

-- 7. Organic amendments ---------------------------------------------------
CREATE TABLE IF NOT EXISTS field_amendments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id         UUID NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  program_id       UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  status           VARCHAR(20) NOT NULL DEFAULT 'in_progress',
  application_date DATE,
  amendment_type   VARCHAR(150),
  source           VARCHAR(100),
  rate             NUMERIC(10, 2),
  rate_unit        VARCHAR(50),
  n_pct            NUMERIC(6, 2),
  p2o5_pct         NUMERIC(6, 2),
  k2o_pct          NUMERIC(6, 2),
  incorporated     BOOLEAN,
  notes            TEXT,
  created_by       UUID REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ,
  CONSTRAINT ck_field_amendments_status
    CHECK (status IN ('in_progress', 'completed'))
);

-- 8. Crops ----------------------------------------------------------------
-- crop_type (cash, cover, forage) is not on the app form yet but the worksheet
-- needs it, so it is here now.
CREATE TABLE IF NOT EXISTS field_crop_records (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id          UUID NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  program_id        UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  status            VARCHAR(20) NOT NULL DEFAULT 'in_progress',
  crop_species      VARCHAR(150),
  crop_type         VARCHAR(50),
  planting_date     DATE,
  harvest_date      DATE,
  seeding_rate      NUMERIC(10, 2),
  seeding_rate_unit VARCHAR(50),
  yield_value       NUMERIC(12, 2),
  yield_unit        VARCHAR(50),
  notes             TEXT,
  created_by        UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ,
  CONSTRAINT ck_field_crop_records_status
    CHECK (status IN ('in_progress', 'completed'))
);

-- 9. Nutrient management --------------------------------------------------
-- The three yes/no answers are what the worksheet actually judges, so they are
-- proper booleans here rather than free text.
CREATE TABLE IF NOT EXISTS field_nutrient_events (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id           UUID NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  program_id         UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  status             VARCHAR(20) NOT NULL DEFAULT 'in_progress',
  event_date         DATE,
  variable_rate      BOOLEAN,
  split_rate         BOOLEAN,
  enhanced_efficiency BOOLEAN,
  application_method VARCHAR(100),
  n_pct              NUMERIC(6, 2),
  p2o5_pct           NUMERIC(6, 2),
  k2o_pct            NUMERIC(6, 2),
  rate_lbs_acre      NUMERIC(10, 2),
  notes              TEXT,
  created_by         UUID REFERENCES users(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at         TIMESTAMPTZ,
  CONSTRAINT ck_field_nutrient_events_status
    CHECK (status IN ('in_progress', 'completed'))
);

-- 10. Documents -----------------------------------------------------------
-- One table for every attachment across every module: the lab report PDF, the
-- training certificate, the extra photos, and the loose files uploaded from the
-- admin panel. record_id points at the row it belongs to, or stays null when
-- the file is attached to the module as a whole.
CREATE TABLE IF NOT EXISTS field_module_documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id    UUID NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  program_id  UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  module      VARCHAR(40) NOT NULL,
  record_id   UUID,
  kind        VARCHAR(30) NOT NULL DEFAULT 'document',
  name        VARCHAR(200) NOT NULL,
  url         TEXT NOT NULL,
  mime_type   VARCHAR(100),
  size_bytes  BIGINT,
  uploaded_by UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ,
  CONSTRAINT ck_field_module_documents_module
    CHECK (module IN (
      'training', 'soil_samples', 'irrigation', 'pesticide', 'fertilizer',
      'tillage', 'amendment', 'crop', 'nutrient', 'other'
    )),
  CONSTRAINT ck_field_module_documents_kind
    CHECK (kind IN ('document', 'photo', 'lab_report', 'certificate'))
);

-- Indexes -----------------------------------------------------------------
-- Every screen asks the same question, "give me this field's records for this
-- program", so that pair is the index on each table.
CREATE INDEX IF NOT EXISTS idx_field_trainings_fp        ON field_trainings (field_id, program_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_field_soil_samples_fp     ON field_soil_samples (field_id, program_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_field_irrigations_fp      ON field_irrigations (field_id, program_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_field_pesticides_fp       ON field_pesticides (field_id, program_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_field_fertilizers_fp      ON field_fertilizers (field_id, program_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_field_tillage_fp          ON field_tillage_records (field_id, program_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_field_amendments_fp       ON field_amendments (field_id, program_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_field_crop_records_fp     ON field_crop_records (field_id, program_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_field_nutrient_events_fp  ON field_nutrient_events (field_id, program_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_field_module_documents_fp ON field_module_documents (field_id, program_id, module) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_field_module_documents_rec ON field_module_documents (record_id) WHERE deleted_at IS NULL;
