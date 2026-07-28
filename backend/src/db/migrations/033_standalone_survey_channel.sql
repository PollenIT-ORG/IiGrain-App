-- 033_standalone_survey_channel.sql
-- The standalone survey flow: a single survey page (no full website, no
-- password) where the producer is tracked entirely by email and magic links.
-- It reuses the same eligibility_submissions / contracts tables and the same
-- admin screens; these two columns are all that is needed to tell the channels
-- apart and to open a passwordless status link.

-- Which entry point the submission came through.
ALTER TABLE eligibility_submissions
  ADD COLUMN IF NOT EXISTS channel VARCHAR(20) NOT NULL DEFAULT 'website';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'eligibility_submissions'
      AND constraint_name = 'chk_submission_channel'
  ) THEN
    ALTER TABLE eligibility_submissions
      ADD CONSTRAINT chk_submission_channel
      CHECK (channel IN ('website','standalone'));
  END IF;
END$$;

-- Random token for the passwordless status link emailed at every step. Only the
-- standalone flow uses it, so it stays null for website submissions.
ALTER TABLE eligibility_submissions
  ADD COLUMN IF NOT EXISTS status_token VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS uq_submission_status_token
  ON eligibility_submissions (status_token) WHERE status_token IS NOT NULL;
