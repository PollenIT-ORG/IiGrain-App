-- Office hours shown on the website contact page. Email, phone and address
-- already exist on organizations; this is the only missing piece.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS contact_hours VARCHAR(200);
