-- Dates and times are shown in the organization's own timezone and clock,
-- rather than whatever each viewer's computer happens to be set to. Central
-- Time on a 12 hour clock is the default.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS timezone VARCHAR(64) NOT NULL DEFAULT 'America/Chicago',
  ADD COLUMN IF NOT EXISTS time_format VARCHAR(3) NOT NULL DEFAULT '12h';
