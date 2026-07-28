-- 019_programs_and_enrollments.sql
-- Program layer: an Organization runs one or more Programs (schemes, e.g. a
-- govt wheat scheme). A Program Authorizer (program_administrator) creates a
-- program and enrolls farmers into it, choosing which of the farmer's fields
-- belong to the program. A program may cap how many farmers can enroll
-- (user_limit); NULL means unlimited.
--
-- Hierarchy: organization → program → enrollment (farmer) → enrolled fields.

-- ── Programs: a scheme within an organization. ──
CREATE TABLE IF NOT EXISTS programs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        VARCHAR(150) NOT NULL,        -- e.g. 'Govt Wheat Scheme 2026'
  code        VARCHAR(50),                  -- short identifier (optional)
  description TEXT,
  type        VARCHAR(50),                  -- e.g. 'government', 'private'
  start_date  DATE,
  end_date    DATE,
  -- Max number of farmers that can be enrolled. NULL = unlimited.
  user_limit  INTEGER,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ,
  -- A non-negative limit when set.
  CONSTRAINT chk_programs_user_limit CHECK (user_limit IS NULL OR user_limit >= 0)
);

CREATE INDEX IF NOT EXISTS idx_programs_org
  ON programs (org_id) WHERE deleted_at IS NULL;

-- ── Program enrollments: a farmer enrolled into a program. ──
-- One live enrollment per (program, farmer). A farmer may be enrolled in many
-- programs; a program may enroll many farmers (bounded by user_limit).
CREATE TABLE IF NOT EXISTS program_enrollments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id  UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  farmer_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  enrolled_by UUID REFERENCES users(id) ON DELETE SET NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'suspended')),
  note        TEXT,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

-- One live enrollment per farmer per program.
CREATE UNIQUE INDEX IF NOT EXISTS uq_program_enrollments_alive
  ON program_enrollments (program_id, farmer_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_program_enrollments_program
  ON program_enrollments (program_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_program_enrollments_farmer
  ON program_enrollments (farmer_id) WHERE deleted_at IS NULL;

-- ── Enrolled fields: the SPECIFIC fields of the farmer that are in the program.
-- A farmer may put only some fields into a program (e.g. 2 wheat fields, not the
-- rice field). A field can belong to different programs across enrollments.
CREATE TABLE IF NOT EXISTS program_enrollment_fields (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES program_enrollments(id) ON DELETE CASCADE,
  field_id      UUID NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ
);

-- One live link per (enrollment, field).
CREATE UNIQUE INDEX IF NOT EXISTS uq_program_enrollment_fields_alive
  ON program_enrollment_fields (enrollment_id, field_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_program_enrollment_fields_field
  ON program_enrollment_fields (field_id) WHERE deleted_at IS NULL;
