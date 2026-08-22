-- The phone shown against a submission used to come from the producer's
-- account, which is shared across every survey they take. Leaving the field
-- blank then showed a number from an earlier survey. Each submission now keeps
-- the phone that was given for it.
ALTER TABLE program_admin_survey_submissions
  ADD COLUMN IF NOT EXISTS phone VARCHAR(30);
