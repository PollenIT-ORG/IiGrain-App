-- Help screen questions, written in the admin panel and read by the app, so a
-- wording change does not need an app release.
-- sort_order decides the order shown; is_active hides one without deleting it.

CREATE TABLE IF NOT EXISTS faqs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question    VARCHAR(300) NOT NULL,
  answer      TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

-- The app reads only live, active rows in order, which is this index exactly.
CREATE INDEX IF NOT EXISTS idx_faqs_active_order
  ON faqs (sort_order, created_at)
  WHERE deleted_at IS NULL AND is_active = true;

-- Enquiries are listed newest first, and the unread filter is the common one.
CREATE INDEX IF NOT EXISTS idx_contact_enquiries_created
  ON contact_enquiries (created_at DESC)
  WHERE deleted_at IS NULL;
