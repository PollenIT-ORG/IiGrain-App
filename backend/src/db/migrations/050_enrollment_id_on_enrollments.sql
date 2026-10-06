-- An Enrollment ID belongs to one farmer and one program. It is issued when a
-- survey submission is accepted, and from then on it is what lets that farmer
-- register and enroll in that program.
--
-- Until now the ID only existed on the survey submission. Farmers enrolled
-- before this rule have no submission at all, so they would be left holding
-- nothing and the new checks would lock them out. The column below carries the
-- ID on the enrollment itself, and the backfill gives every existing enrollment
-- one, silently.
ALTER TABLE program_enrollments
  ADD COLUMN IF NOT EXISTS enrollment_id VARCHAR(32);

-- Fill in the ones that came through a survey first, so an existing farmer
-- keeps the exact ID already sitting in their inbox rather than a new one.
-- The applicant's email lives on website_users, not on the submission itself.
UPDATE program_enrollments pe
   SET enrollment_id = s.enrollment_id
  FROM program_admin_survey_submissions s
  JOIN program_admin_surveys srv
    ON srv.id = s.survey_id AND srv.deleted_at IS NULL
  JOIN website_users wu
    ON wu.id = s.website_user_id
  JOIN users u
    ON lower(u.email) = lower(wu.email) AND u.deleted_at IS NULL
 WHERE pe.enrollment_id IS NULL
   AND pe.deleted_at IS NULL
   AND s.deleted_at IS NULL
   AND s.enrollment_id IS NOT NULL
   AND srv.program_id = pe.program_id
   AND u.id = pe.farmer_id;

-- Everyone else gets a fresh one in the same IIG-YYYY-NNNNNN shape. The loop
-- retries on the unique index rather than trusting a single random draw.
DO $$
DECLARE
  row_rec   RECORD;
  candidate TEXT;
  taken     BOOLEAN;
  attempt   INT;
BEGIN
  FOR row_rec IN
    SELECT pe.id, EXTRACT(YEAR FROM pe.enrolled_at)::INT AS yr
      FROM program_enrollments pe
     WHERE pe.enrollment_id IS NULL
       AND pe.deleted_at IS NULL
  LOOP
    attempt := 0;
    LOOP
      attempt := attempt + 1;
      candidate := 'IIG-' || row_rec.yr || '-' ||
                   lpad((floor(random() * 900000) + 100000)::INT::TEXT, 6, '0');
      SELECT EXISTS (
        SELECT 1 FROM program_enrollments WHERE enrollment_id = candidate
        UNION ALL
        SELECT 1 FROM program_admin_survey_submissions WHERE enrollment_id = candidate
      ) INTO taken;
      EXIT WHEN NOT taken OR attempt > 50;
    END LOOP;
    UPDATE program_enrollments SET enrollment_id = candidate WHERE id = row_rec.id;
  END LOOP;
END $$;

-- One ID, one enrollment. Partial so soft-deleted rows never block a reissue.
CREATE UNIQUE INDEX IF NOT EXISTS uq_program_enrollments_enrollment_id
  ON program_enrollments (enrollment_id)
  WHERE enrollment_id IS NOT NULL AND deleted_at IS NULL;

-- Looked up on every registration attempt, so it is worth an index.
CREATE INDEX IF NOT EXISTS idx_program_enrollments_enrollment_id
  ON program_enrollments (enrollment_id);
