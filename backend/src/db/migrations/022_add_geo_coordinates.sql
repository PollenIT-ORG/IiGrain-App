-- 022_add_geo_coordinates.sql
-- Adds precise GPS coordinates to farms and fields so location can be captured
-- from an interactive map (Leaflet) instead of typed free-text. The existing
-- `location` TEXT column stays for a human-readable address/description; these
-- new columns hold the machine-usable point.
--
-- NUMERIC(9,6): latitude range [-90, 90], longitude range [-180, 180], 6 decimal
-- places (~0.11 m precision) - the standard for storing GPS coordinates.

ALTER TABLE farms
  ADD COLUMN IF NOT EXISTS latitude  NUMERIC(9, 6),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(9, 6);

ALTER TABLE fields
  ADD COLUMN IF NOT EXISTS latitude  NUMERIC(9, 6),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(9, 6);

-- Guard against out-of-range values at the DB level (NULL always allowed).
ALTER TABLE farms
  DROP CONSTRAINT IF EXISTS chk_farms_latitude,
  DROP CONSTRAINT IF EXISTS chk_farms_longitude;
ALTER TABLE farms
  ADD CONSTRAINT chk_farms_latitude  CHECK (latitude  IS NULL OR (latitude  BETWEEN -90  AND 90)),
  ADD CONSTRAINT chk_farms_longitude CHECK (longitude IS NULL OR (longitude BETWEEN -180 AND 180));

ALTER TABLE fields
  DROP CONSTRAINT IF EXISTS chk_fields_latitude,
  DROP CONSTRAINT IF EXISTS chk_fields_longitude;
ALTER TABLE fields
  ADD CONSTRAINT chk_fields_latitude  CHECK (latitude  IS NULL OR (latitude  BETWEEN -90  AND 90)),
  ADD CONSTRAINT chk_fields_longitude CHECK (longitude IS NULL OR (longitude BETWEEN -180 AND 180));
