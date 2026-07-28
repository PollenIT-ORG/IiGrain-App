-- ============================================================================
-- PRODUCTION FIX - apply migrations 019 + 020 (Programs + Assessor dual-assessment)
--
-- WHY: The new code deploys use `ON CONFLICT (field_id, question_id, author_role)`
-- and the `programs`/`author_role` columns. If these migrations never ran on the
-- production DB, saving an answer fails with:
--   ERROR 42P10: there is no unique or exclusion constraint matching the
--   ON CONFLICT specification
--
-- HOW: Run this whole file ONCE against the production database (psql, Neon SQL
-- editor, etc.). It is IDEMPOTENT - safe to run again; already-applied parts are
-- skipped. It also records the two migrations in `_migrations` so the app's
-- startup runner won't try to re-apply them.
--
-- Order matters: 019 creates `programs` (referenced by 020's program_id FKs),
-- so 019 runs first.
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 019 - Programs + enrollments
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS programs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        VARCHAR(150) NOT NULL,
  code        VARCHAR(50),
  description TEXT,
  type        VARCHAR(50),
  start_date  DATE,
  end_date    DATE,
  user_limit  INTEGER,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ,
  CONSTRAINT chk_programs_user_limit CHECK (user_limit IS NULL OR user_limit >= 0)
);

CREATE INDEX IF NOT EXISTS idx_programs_org
  ON programs (org_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS program_enrollments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id  UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  farmer_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  enrolled_by UUID REFERENCES users(id) ON DELETE SET NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'suspended')),
  note        TEXT,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_program_enrollments_alive
  ON program_enrollments (program_id, farmer_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_program_enrollments_program
  ON program_enrollments (program_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_program_enrollments_farmer
  ON program_enrollments (farmer_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS program_enrollment_fields (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES program_enrollments(id) ON DELETE CASCADE,
  field_id      UUID NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_program_enrollment_fields_alive
  ON program_enrollment_fields (enrollment_id, field_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_program_enrollment_fields_field
  ON program_enrollment_fields (field_id) WHERE deleted_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 020 - Assessor dual assessment (author_role) + program links
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE assessment_responses
  ADD COLUMN IF NOT EXISTS author_role VARCHAR(20) NOT NULL DEFAULT 'farmer'
    CHECK (author_role IN ('farmer', 'assessor'));

ALTER TABLE assessment_responses
  ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE assessment_responses
  ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES programs(id) ON DELETE SET NULL;

DROP INDEX IF EXISTS uq_assessment_responses_field_question;

CREATE UNIQUE INDEX IF NOT EXISTS uq_assessment_responses_field_question_role
  ON assessment_responses (field_id, question_id, author_role)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_assessment_responses_field_role
  ON assessment_responses (field_id, author_role)
  WHERE deleted_at IS NULL;

ALTER TABLE field_assessments
  ADD COLUMN IF NOT EXISTS author_role VARCHAR(20) NOT NULL DEFAULT 'farmer'
    CHECK (author_role IN ('farmer', 'assessor'));

ALTER TABLE field_assessments
  ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE field_assessments
  ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES programs(id) ON DELETE SET NULL;

DROP INDEX IF EXISTS uq_field_assessments_field;

CREATE UNIQUE INDEX IF NOT EXISTS uq_field_assessments_field_role
  ON field_assessments (field_id, author_role);

-- ─────────────────────────────────────────────────────────────────────────────
-- Record both in the app's migration ledger so startup won't re-run them.
-- (The app tracks applied files in `_migrations`.)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS _migrations (
  id          SERIAL PRIMARY KEY,
  filename    VARCHAR(255) NOT NULL UNIQUE,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO _migrations (filename) VALUES
  ('019_programs_and_enrollments.sql'),
  ('020_assessor_dual_assessment.sql')
ON CONFLICT (filename) DO NOTHING;

COMMIT;

-- Quick verification (run after commit):
--   SELECT indexname FROM pg_indexes
--    WHERE tablename='assessment_responses'
--      AND indexname='uq_assessment_responses_field_question_role';
--   -- should return one row.
