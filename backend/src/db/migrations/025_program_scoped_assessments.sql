-- 025_program_scoped_assessments.sql
-- Make assessments PROGRAM-SCOPED. Before this, an assessment was keyed by
-- (field_id, author_role), so a field enrolled in several programs shared one
-- assessment. Now each (field, author_role, program) has its own assessment and
-- its own answers. The program_id columns already exist (migration 020) but were
-- not part of the unique keys; this migration promotes them.

-- 1. Backfill any missing program_id from the field's latest live enrollment
--    (the rule the code used to guess). Existing rows already carry program_id,
--    so this is defensive.
UPDATE assessment_responses ar
   SET program_id = sub.program_id
  FROM (
    SELECT DISTINCT ON (pef.field_id) pef.field_id, pe.program_id
      FROM program_enrollment_fields pef
      JOIN program_enrollments pe ON pe.id = pef.enrollment_id AND pe.deleted_at IS NULL
     WHERE pef.deleted_at IS NULL
     ORDER BY pef.field_id, pe.enrolled_at DESC
  ) sub
 WHERE ar.program_id IS NULL AND ar.field_id = sub.field_id;

UPDATE field_assessments fa
   SET program_id = sub.program_id
  FROM (
    SELECT DISTINCT ON (pef.field_id) pef.field_id, pe.program_id
      FROM program_enrollment_fields pef
      JOIN program_enrollments pe ON pe.id = pef.enrollment_id AND pe.deleted_at IS NULL
     WHERE pef.deleted_at IS NULL
     ORDER BY pef.field_id, pe.enrolled_at DESC
  ) sub
 WHERE fa.program_id IS NULL AND fa.field_id = sub.field_id;

-- 2. Delete orphan rows whose field has no live enrollment (cannot be scoped to
--    a program). Safe on the current test data (0 such rows expected).
DELETE FROM assessment_responses WHERE program_id IS NULL;
DELETE FROM field_assessments   WHERE program_id IS NULL;

-- 3. program_id is now mandatory (an assessment always belongs to a program).
ALTER TABLE assessment_responses ALTER COLUMN program_id SET NOT NULL;
ALTER TABLE field_assessments    ALTER COLUMN program_id SET NOT NULL;

-- 4. Rebuild the unique keys to include program_id.
DROP INDEX IF EXISTS uq_assessment_responses_field_question_role;
DROP INDEX IF EXISTS uq_assessment_responses_field_question; -- stale pre-role variant
CREATE UNIQUE INDEX IF NOT EXISTS uq_assessment_responses_field_question_role_program
  ON assessment_responses (field_id, question_id, author_role, program_id)
  WHERE deleted_at IS NULL;

DROP INDEX IF EXISTS uq_field_assessments_field_role;
CREATE UNIQUE INDEX IF NOT EXISTS uq_field_assessments_field_role_program
  ON field_assessments (field_id, author_role, program_id);

-- 5. Helpful lookup indexes for the program-scoped reads.
CREATE INDEX IF NOT EXISTS idx_assessment_responses_field_role_program
  ON assessment_responses (field_id, author_role, program_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_field_assessments_field_role_program
  ON field_assessments (field_id, author_role, program_id);
