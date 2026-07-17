-- 018_field_soil_and_documents.sql
-- Per-field Soil record (one row per field, upserted) and Documents (many per
-- field). Drives the Soil and Docs tabs on the Field Details screen.

-- Soil: one record per field (the latest soil profile). Upserted.
CREATE TABLE IF NOT EXISTS field_soil (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id       UUID NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  ph             NUMERIC(4, 2),          -- e.g. 6.50
  organic_matter NUMERIC(5, 2),          -- percent, e.g. 3.20
  nitrogen       NUMERIC(7, 2),          -- N (ppm or kg/ha - app-defined)
  phosphorus     NUMERIC(7, 2),          -- P
  potassium      NUMERIC(7, 2),          -- K
  moisture       NUMERIC(5, 2),          -- percent
  texture        VARCHAR(50),            -- e.g. 'Loam', 'Clay', 'Sandy'
  notes          TEXT,
  tested_on      DATE,                   -- when the sample was taken/tested
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at     TIMESTAMPTZ
);

-- One live soil record per field (the Soil tab shows/edits exactly one).
CREATE UNIQUE INDEX IF NOT EXISTS uq_field_soil_field_alive
  ON field_soil (field_id) WHERE deleted_at IS NULL;

-- Documents: many per field. Files live in Cloudinary; we store the URL.
CREATE TABLE IF NOT EXISTS field_documents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id     UUID NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  name         VARCHAR(200) NOT NULL,        -- display name / title
  url          TEXT NOT NULL,                -- Cloudinary secure URL
  mime_type    VARCHAR(100),                 -- e.g. application/pdf, image/jpeg
  size_bytes   BIGINT,                       -- file size if known
  uploaded_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_field_documents_field
  ON field_documents (field_id) WHERE deleted_at IS NULL;
