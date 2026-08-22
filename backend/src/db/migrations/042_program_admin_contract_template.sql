-- ===========================================================================
-- Program Admin Survey - contract templates. Same shape as the survey
-- templates: one shared global template (read-only), plus each program
-- administrator's own copies. A program points at the contract template its
-- producers sign.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS program_admin_contract_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID,
  is_global   BOOLEAN NOT NULL DEFAULT false,
  name        VARCHAR(150) NOT NULL,
  intro       TEXT,
  -- [{ "heading": "1. The program", "body": "..." }, ...]
  clauses     JSONB NOT NULL DEFAULT '[]',
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_by  UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_pact_owner ON program_admin_contract_templates (owner_id);
CREATE INDEX IF NOT EXISTS idx_pact_global ON program_admin_contract_templates (is_global);

-- Which contract a program's producers sign. NULL falls back to the global one.
ALTER TABLE program_admin_surveys
  ADD COLUMN IF NOT EXISTS contract_template_id UUID
  REFERENCES program_admin_contract_templates (id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_pas_surveys_contract_tpl
  ON program_admin_surveys (contract_template_id);
