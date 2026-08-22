-- Stores the admin's note when they override a submission's qualification band.
-- Shown back on the submission detail page and kept for the audit trail.
ALTER TABLE eligibility_submissions
  ADD COLUMN IF NOT EXISTS override_reason TEXT;
