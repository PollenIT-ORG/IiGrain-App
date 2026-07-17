-- 021_enrollment_assessor.sql
-- Assign an assessor to a farmer WITHIN a program enrollment. One assessor per
-- enrolled farmer (per program); an assessor may cover many farmers. The
-- assessor is chosen when enrolling the farmer.

ALTER TABLE program_enrollments
  ADD COLUMN IF NOT EXISTS assessor_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_program_enrollments_assessor
  ON program_enrollments (assessor_id) WHERE deleted_at IS NULL;
