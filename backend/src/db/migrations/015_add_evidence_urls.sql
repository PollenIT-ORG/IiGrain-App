-- Evidence photos for an assessment answer. The mobile app uploads images to
-- Cloudinary directly (unsigned) and sends back only the resulting URLs - we
-- store the links, never the binaries. Max 5 is enforced in the API layer; the
-- CHECK here is a DB-level backstop.
ALTER TABLE assessment_responses
  ADD COLUMN IF NOT EXISTS evidence_urls TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE assessment_responses
  DROP CONSTRAINT IF EXISTS chk_assessment_responses_evidence_max;

ALTER TABLE assessment_responses
  ADD CONSTRAINT chk_assessment_responses_evidence_max
  CHECK (array_length(evidence_urls, 1) IS NULL OR array_length(evidence_urls, 1) <= 5);
