-- Position history for visits (4.2) + an anti-spoof marker (4.4). The runner
-- wraps this file in a transaction.

CREATE TABLE IF NOT EXISTS field_visit_locations (
  id          BIGSERIAL PRIMARY KEY,
  visit_id    UUID NOT NULL REFERENCES field_visits(id) ON DELETE CASCADE,
  latitude    NUMERIC(9, 6) NOT NULL,
  longitude   NUMERIC(9, 6) NOT NULL,
  accuracy_m  NUMERIC(6, 1),
  is_mock     BOOLEAN NOT NULL DEFAULT false,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fvl_visit_time
  ON field_visit_locations (visit_id, recorded_at);

-- Anti-spoof marker for a human to review. NULL = clean.
ALTER TABLE field_visits
  ADD COLUMN IF NOT EXISTS location_flag VARCHAR(40);

COMMENT ON COLUMN field_visits.location_flag IS
  'Anti-spoof marker for review: mock_location | impossible_speed | teleport. NULL = clean.';

-- Allow the new 'expired' terminal status set by the abandoned-visit auto-close.
ALTER TABLE field_visits DROP CONSTRAINT IF EXISTS field_visits_status_check;
ALTER TABLE field_visits ADD CONSTRAINT field_visits_status_check
  CHECK (status IN ('en_route', 'arrived', 'completed', 'cancelled', 'expired'));
