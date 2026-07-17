-- 024_notifications.sql
-- Per-user notifications. A notification is created when something relevant
-- happens to a user (a new program they can join, an enrollment, an assessor
-- assigned/visiting, an assessment submitted). It is persisted here AND pushed
-- live over socket.io to the user's room, so the bell updates without a refresh.
--
-- `data` (JSONB) carries a small, typed payload the client uses to deep-link
-- (e.g. { "programId": "...", "fieldId": "..." }).

CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- A stable machine key for the client to pick an icon / route.
  type        VARCHAR(50) NOT NULL,
  title       VARCHAR(200) NOT NULL,
  body        TEXT,
  -- Optional deep-link payload (ids, etc.).
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- NULL until the user reads it; set to now() when marked read.
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

-- Newest-first per user, with a fast unread filter.
CREATE INDEX IF NOT EXISTS idx_notifications_user
  ON notifications (user_id, created_at DESC) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON notifications (user_id) WHERE read_at IS NULL AND deleted_at IS NULL;
