-- ============================================================================
-- RECOVERY: recreate the two accidentally-dropped tables in their FINAL shape.
--
--   assessment_responses  (was created in 014, evidence_urls in 015, author_role
--                          + author_id + program_id + role-scoped index in 020)
--   field_assessments     (was created in 016, author_role + author_id +
--                          program_id + role-scoped unique index in 020)
--
-- WHY the app's own sync couldn't restore them: migrations 014/015/016/020 are
-- already recorded in `_migrations`, so the startup runner skips them (thinking
-- they're applied). This script rebuilds BOTH tables at their current schema in
-- one go. It is IDEMPOTENT (CREATE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS) -
-- safe to run once against the Neon DB, and safe to re-run.
--
-- It does NOT touch `_migrations` (those rows are already correct).
--
-- HOW: run this whole file once against the database (psql / Neon SQL editor).
-- ============================================================================

BEGIN;

-- ── assessment_responses (final shape: 014 + 015 + 020) ─────────────────────
CREATE TABLE IF NOT EXISTS assessment_responses (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id      UUID        NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  question_id   UUID        NOT NULL REFERENCES assessment_questions(id) ON DELETE CASCADE,
  score         SMALLINT    NOT NULL CHECK (score BETWEEN 0 AND 3),
  comment       TEXT,
  -- 015: evidence photo/video URLs (Cloudinary), max 5.
  evidence_urls TEXT[]      NOT NULL DEFAULT '{}',
  -- 020: who authored the answer + program context.
  author_role   VARCHAR(20) NOT NULL DEFAULT 'farmer'
                  CHECK (author_role IN ('farmer', 'assessor')),
  author_id     UUID        REFERENCES users(id) ON DELETE SET NULL,
  program_id    UUID        REFERENCES programs(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ
);

-- 015: cap evidence at 5 (DB-level backstop).
ALTER TABLE assessment_responses
  DROP CONSTRAINT IF EXISTS chk_assessment_responses_evidence_max;
ALTER TABLE assessment_responses
  ADD CONSTRAINT chk_assessment_responses_evidence_max
  CHECK (array_length(evidence_urls, 1) IS NULL OR array_length(evidence_urls, 1) <= 5);

-- If an older single-role index somehow exists, drop it (020 replaced it).
DROP INDEX IF EXISTS uq_assessment_responses_field_question;

-- 020: one live answer per (field, question, author_role) - farmer + assessor
-- can each answer.
CREATE UNIQUE INDEX IF NOT EXISTS uq_assessment_responses_field_question_role
  ON assessment_responses (field_id, question_id, author_role)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_assessment_responses_field
  ON assessment_responses (field_id)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_assessment_responses_field_role
  ON assessment_responses (field_id, author_role)
  WHERE deleted_at IS NULL;

-- ── field_assessments (final shape: 016 + 020) ──────────────────────────────
CREATE TABLE IF NOT EXISTS field_assessments (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id        UUID        NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  status          VARCHAR(20) NOT NULL DEFAULT 'submitted'
                    CHECK (status IN ('draft', 'submitted')),
  total_questions INTEGER     NOT NULL DEFAULT 0,
  answered        INTEGER     NOT NULL DEFAULT 0,
  total_score     INTEGER     NOT NULL DEFAULT 0,
  max_score       INTEGER     NOT NULL DEFAULT 0,
  percentage      NUMERIC(5,2) NOT NULL DEFAULT 0,
  submitted_at    TIMESTAMPTZ,
  -- 020: one submission record PER ROLE per field + program context.
  author_role     VARCHAR(20) NOT NULL DEFAULT 'farmer'
                    CHECK (author_role IN ('farmer', 'assessor')),
  author_id       UUID        REFERENCES users(id) ON DELETE SET NULL,
  program_id      UUID        REFERENCES programs(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Drop the old one-per-field unique if it exists (020 replaced it).
DROP INDEX IF EXISTS uq_field_assessments_field;

-- 020: one submission per (field, author_role) - farmer + assessor coexist.
CREATE UNIQUE INDEX IF NOT EXISTS uq_field_assessments_field_role
  ON field_assessments (field_id, author_role);

COMMIT;

-- Verify after commit:
--   SELECT table_name FROM information_schema.tables
--    WHERE table_schema='public'
--      AND table_name IN ('assessment_responses','field_assessments');
--   -- should return BOTH rows.
