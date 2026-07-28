-- Adds the new platform roles (super_admin, program_administrator) and the
-- assessor↔farmer assignment table that lets a program administrator assign an
-- assessor to visit a farmer.

-- ── New roles ──
-- super_admin            : platform owner (god mode), creates admins.
-- program_administrator  : acts on the admin's behalf within an org - creates
--                          assessors/farmers/farms and assigns assessors. Cannot
--                          create other program administrators.
INSERT INTO roles (name, description) VALUES
  ('super_admin', 'Platform owner with full access across all organizations.'),
  ('program_administrator', 'Manages assessors, farmers and farms within an organization on the admin''s behalf.')
ON CONFLICT (name) DO NOTHING;

-- ── Assessor assignments ──
-- One row links an assessor to a farmer (for visits), recorded with who assigned
-- it and under which organization. A farmer can have multiple assessors over
-- time; the partial unique index prevents duplicate LIVE assignments of the same
-- assessor↔farmer pair.
CREATE TABLE IF NOT EXISTS assessor_assignments (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  assessor_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  farmer_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
  org_id       UUID        REFERENCES organizations(id) ON DELETE SET NULL,
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at   TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_assessor_assignments_pair_alive
  ON assessor_assignments (assessor_id, farmer_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_assessor_assignments_assessor
  ON assessor_assignments (assessor_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_assessor_assignments_farmer
  ON assessor_assignments (farmer_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_assessor_assignments_org
  ON assessor_assignments (org_id) WHERE deleted_at IS NULL;
