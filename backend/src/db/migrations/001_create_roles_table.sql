-- 001_create_roles_table.sql
-- Roles are a small, fixed lookup table. Seeded values: farmer, assessor,
-- program_partner, admin (see the seed runner).

CREATE TABLE IF NOT EXISTS roles (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
