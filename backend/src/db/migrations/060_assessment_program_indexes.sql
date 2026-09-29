-- Answers and submissions looked up by program alone: the template lock, the change-template check and the program dashboard.

CREATE INDEX IF NOT EXISTS idx_assessment_responses_program
  ON assessment_responses (program_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_field_assessments_program_status
  ON field_assessments (program_id, status);
