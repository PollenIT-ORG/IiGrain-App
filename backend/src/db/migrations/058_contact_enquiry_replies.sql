-- What the office wrote back to a contact enquiry. Kept so whoever opens the
-- message next can see what was already said, when, and to which address.

CREATE TABLE IF NOT EXISTS contact_enquiry_replies (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_id UUID NOT NULL REFERENCES contact_enquiries(id) ON DELETE CASCADE,
  to_email   VARCHAR(255) NOT NULL,
  subject    VARCHAR(150) NOT NULL,
  message    TEXT NOT NULL,
  sent_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- One enquiry's thread at a time, newest first.
CREATE INDEX IF NOT EXISTS idx_contact_enquiry_replies_enquiry
  ON contact_enquiry_replies (enquiry_id, created_at DESC)
  WHERE deleted_at IS NULL;
