-- An account made from the admin panel gets a temporary password the office
-- knows. Until the owner replaces it, the account cannot sign in at all, so a
-- password somebody else chose never becomes a working session.
-- Existing accounts are left alone: false means nothing to do.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;
