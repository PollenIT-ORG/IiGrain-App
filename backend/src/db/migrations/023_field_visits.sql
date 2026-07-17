-- 023_field_visits.sql
-- Real-time assessor field visits. When an assessor (assigned to a farmer) goes
-- to visit a farm/field in person, they START a visit. While it is active the
-- assessor's live GPS location streams over a socket to the farmer (and admins).
-- On arrival / completion the visit ENDS and location sharing stops.
--
-- One row per visit (a history of visits builds up). `last_*` columns hold the
-- most recent location snapshot so a late joiner / the admin panel / a REST poll
-- can render the current position without replaying the socket stream.

CREATE TABLE IF NOT EXISTS field_visits (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessor_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  farmer_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Optional context: which program / field this visit is for.
  program_id    UUID REFERENCES programs(id) ON DELETE SET NULL,
  field_id      UUID REFERENCES fields(id)  ON DELETE SET NULL,

  status        VARCHAR(20) NOT NULL DEFAULT 'en_route'
                  CHECK (status IN ('en_route', 'arrived', 'completed', 'cancelled')),

  -- Destination snapshot (the field/farm point) captured at start, so the
  -- farmer/admin map can show the target even if the field moves later.
  dest_latitude   NUMERIC(9, 6),
  dest_longitude  NUMERIC(9, 6),

  -- Most recent assessor position (updated as the socket stream comes in).
  last_latitude   NUMERIC(9, 6),
  last_longitude  NUMERIC(9, 6),
  last_location_at TIMESTAMPTZ,

  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  arrived_at    TIMESTAMPTZ,
  ended_at      TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_field_visits_dest_lat CHECK (dest_latitude IS NULL OR (dest_latitude BETWEEN -90 AND 90)),
  CONSTRAINT chk_field_visits_dest_lng CHECK (dest_longitude IS NULL OR (dest_longitude BETWEEN -180 AND 180)),
  CONSTRAINT chk_field_visits_last_lat CHECK (last_latitude IS NULL OR (last_latitude BETWEEN -90 AND 90)),
  CONSTRAINT chk_field_visits_last_lng CHECK (last_longitude IS NULL OR (last_longitude BETWEEN -180 AND 180))
);

-- At most ONE active (en_route/arrived) visit per assessor at a time.
CREATE UNIQUE INDEX IF NOT EXISTS uq_field_visits_active_assessor
  ON field_visits (assessor_id)
  WHERE status IN ('en_route', 'arrived');

-- Fast lookups of a farmer's / assessor's active visit and history.
CREATE INDEX IF NOT EXISTS idx_field_visits_farmer   ON field_visits (farmer_id, status);
CREATE INDEX IF NOT EXISTS idx_field_visits_assessor ON field_visits (assessor_id, status);
CREATE INDEX IF NOT EXISTS idx_field_visits_active
  ON field_visits (status) WHERE status IN ('en_route', 'arrived');
