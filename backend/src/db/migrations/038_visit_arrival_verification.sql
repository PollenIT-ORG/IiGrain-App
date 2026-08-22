-- Arrival verification for field visits. Additive and nullable: existing rows
-- read as "not verified", which is accurate - they were recorded before this
-- existed. The migration runner wraps this file in a transaction.

ALTER TABLE field_visits
  ADD COLUMN IF NOT EXISTS arrival_latitude   NUMERIC(9, 6),
  ADD COLUMN IF NOT EXISTS arrival_longitude  NUMERIC(9, 6),
  ADD COLUMN IF NOT EXISTS arrival_accuracy_m NUMERIC(6, 1),
  ADD COLUMN IF NOT EXISTS arrival_distance_m NUMERIC(10, 1),
  ADD COLUMN IF NOT EXISTS arrival_verified   BOOLEAN;

COMMENT ON COLUMN field_visits.arrival_distance_m IS
  'Metres from the field edge (0 = inside). NULL when the field has no geometry.';
COMMENT ON COLUMN field_visits.arrival_verified IS
  'TRUE within tolerance, FALSE outside it, NULL when it could not be checked.';
