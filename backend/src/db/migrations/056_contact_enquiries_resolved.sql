-- Read and resolved are different things: read means somebody opened it,
-- resolved means the producer's problem was actually dealt with. The list is
-- worked from the unresolved end, so that is what the index covers.

ALTER TABLE contact_enquiries
  ADD COLUMN IF NOT EXISTS is_resolved BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE contact_enquiries
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_contact_enquiries_open
  ON contact_enquiries (created_at DESC)
  WHERE deleted_at IS NULL AND is_resolved = false;
