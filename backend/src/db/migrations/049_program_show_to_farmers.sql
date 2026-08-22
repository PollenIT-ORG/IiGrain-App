-- Whether a program is offered to the farmers already on the platform, rather
-- than only to people arriving from a public survey link. It stays off until
-- someone turns it on, and it can only be turned on once the program has a
-- survey, because the farmer is sent straight to that survey to apply.
ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS show_to_farmers BOOLEAN NOT NULL DEFAULT false;
