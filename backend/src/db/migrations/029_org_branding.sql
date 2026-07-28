-- 029_org_branding.sql
-- Branding for the organization: a logo and a favicon (both Cloudinary URLs).
-- Shown in the admin panel and available through the public /config endpoint.
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS favicon_url TEXT;
