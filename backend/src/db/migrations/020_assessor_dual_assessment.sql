-- 020_assessor_dual_assessment.sql
-- Fresh independent assessment: the farmer self-assesses a field, AND an
-- assessor independently assesses the SAME field/questions. Both are saved so a
-- report can show them side-by-side (Farmer 2 vs Assessor 3). Each side owns its
-- own rows via author_role; a question can therefore have one farmer row and one
-- assessor row.
--
-- Also links assessments to a program (so reporting can roll up per program).

-- ── assessment_responses: who authored the answer ──
ALTER TABLE assessment_responses
  ADD COLUMN IF NOT EXISTS author_role VARCHAR(20) NOT NULL DEFAULT 'farmer'
    CHECK (author_role IN ('farmer', 'assessor'));

-- The user who wrote this answer (the farmer, or the assessor). Nullable so the
-- backfill of existing rows doesn't fail; new rows always set it.
ALTER TABLE assessment_responses
  ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Optional program context for the answer (which program's assessment).
ALTER TABLE assessment_responses
  ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES programs(id) ON DELETE SET NULL;

-- The old uniqueness (one live answer per field+question) must now allow ONE per
-- (field, question, author_role) - so farmer and assessor can each answer.
DROP INDEX IF EXISTS uq_assessment_responses_field_question;

CREATE UNIQUE INDEX IF NOT EXISTS uq_assessment_responses_field_question_role
  ON assessment_responses (field_id, question_id, author_role)
  WHERE deleted_at IS NULL;

-- Fast lookups of a field's answers for a given role.
CREATE INDEX IF NOT EXISTS idx_assessment_responses_field_role
  ON assessment_responses (field_id, author_role)
  WHERE deleted_at IS NULL;

-- ── field_assessments: one submission record PER ROLE per field ──
-- The farmer's submission and the assessor's submission lock independently and
-- each keeps its own score snapshot.
ALTER TABLE field_assessments
  ADD COLUMN IF NOT EXISTS author_role VARCHAR(20) NOT NULL DEFAULT 'farmer'
    CHECK (author_role IN ('farmer', 'assessor'));

-- Who submitted (the farmer or the assessor user id).
ALTER TABLE field_assessments
  ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Program context for the submission (roll-up).
ALTER TABLE field_assessments
  ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES programs(id) ON DELETE SET NULL;

-- Replace the one-per-field unique with one-per-(field, role) so both a farmer
-- submission and an assessor submission can coexist for the same field.
DROP INDEX IF EXISTS uq_field_assessments_field;

CREATE UNIQUE INDEX IF NOT EXISTS uq_field_assessments_field_role
  ON field_assessments (field_id, author_role);
