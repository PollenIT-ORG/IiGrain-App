-- ===========================================================================
-- Program Admin Survey - surveys now attach to a real program from the
-- Programs module instead of carrying their own program name. One survey per
-- program, and one program per survey.
-- ===========================================================================

ALTER TABLE program_admin_surveys
  ADD COLUMN IF NOT EXISTS program_id UUID
  REFERENCES programs (id) ON DELETE CASCADE;

-- The name is inherited from the linked program, so it is no longer required.
ALTER TABLE program_admin_surveys ALTER COLUMN name DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_pas_surveys_program
  ON program_admin_surveys (program_id)
  WHERE deleted_at IS NULL AND program_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_pas_surveys_template
  ON program_admin_surveys (template_id)
  WHERE deleted_at IS NULL;
