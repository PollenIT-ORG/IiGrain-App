-- Per-field assessment submission state. One row per field that has been
-- submitted. While a field has no row (or status='draft'), the farmer can keep
-- editing answers. Once submitted, answers for that field are locked (view-only)
-- and a score snapshot is stored for analytics/history.
CREATE TABLE IF NOT EXISTS field_assessments (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id        UUID        NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  status          VARCHAR(20) NOT NULL DEFAULT 'submitted'
                    CHECK (status IN ('draft', 'submitted')),
  -- Snapshot taken at submit time (so later question edits don't change history).
  total_questions INTEGER     NOT NULL DEFAULT 0,
  answered        INTEGER     NOT NULL DEFAULT 0,
  total_score     INTEGER     NOT NULL DEFAULT 0,  -- sum of answered scores (0-3 each)
  max_score       INTEGER     NOT NULL DEFAULT 0,  -- answered * 3
  percentage      NUMERIC(5,2) NOT NULL DEFAULT 0, -- total_score / max_score * 100
  submitted_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One assessment record per field.
CREATE UNIQUE INDEX IF NOT EXISTS uq_field_assessments_field
  ON field_assessments (field_id);
