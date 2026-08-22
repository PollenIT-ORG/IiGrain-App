-- ===========================================================================
-- Program Admin Survey - a new, isolated module (does not touch the existing
-- eligibility survey). A program administrator picks a survey template (the
-- shared global one or their own custom copy), creates a program, attaches the
-- survey, and shares a program-wise link. Farmers can take one survey per
-- program; each program keeps its own thresholds (on the template) and its own
-- data (scoped to the program administrator who owns it).
-- ===========================================================================

-- A survey template = a reusable set of categories + questions + score
-- thresholds. is_global = the one shared master (copied from the current survey).
-- Custom templates belong to a program administrator (owner_id).
CREATE TABLE IF NOT EXISTS program_admin_survey_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID,
  is_global   BOOLEAN NOT NULL DEFAULT false,
  name        VARCHAR(150) NOT NULL,
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_by  UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_pas_templates_owner ON program_admin_survey_templates (owner_id);
CREATE INDEX IF NOT EXISTS idx_pas_templates_global ON program_admin_survey_templates (is_global);

CREATE TABLE IF NOT EXISTS program_admin_survey_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES program_admin_survey_templates (id) ON DELETE CASCADE,
  name        VARCHAR(150) NOT NULL,
  description TEXT,
  icon        VARCHAR(50),
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_pas_categories_template ON program_admin_survey_categories (template_id);

CREATE TABLE IF NOT EXISTS program_admin_survey_questions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id   UUID NOT NULL REFERENCES program_admin_survey_templates (id) ON DELETE CASCADE,
  category_id   UUID REFERENCES program_admin_survey_categories (id) ON DELETE SET NULL,
  question_text TEXT NOT NULL,
  help_text     TEXT,
  option_0      TEXT,
  option_1      TEXT,
  option_2      TEXT,
  option_3      TEXT,
  weight        INT NOT NULL DEFAULT 1,
  sort_order    INT NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_pas_questions_template ON program_admin_survey_questions (template_id);
CREATE INDEX IF NOT EXISTS idx_pas_questions_category ON program_admin_survey_questions (category_id);

-- Score thresholds live on the template (per-template bands).
CREATE TABLE IF NOT EXISTS program_admin_survey_scoring_rules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES program_admin_survey_templates (id) ON DELETE CASCADE,
  category    VARCHAR(20) NOT NULL,
  min_score   INT NOT NULL,
  max_score   INT NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pas_scoring_template ON program_admin_survey_scoring_rules (template_id);

-- A program (with its attached survey). One survey per program: the program
-- name is what the public survey page shows, and the token is the shareable
-- link. owner_id = the program administrator who created it (data scoping).
CREATE TABLE IF NOT EXISTS program_admin_surveys (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID NOT NULL,
  name        VARCHAR(150) NOT NULL,
  description TEXT,
  template_id UUID NOT NULL REFERENCES program_admin_survey_templates (id) ON DELETE RESTRICT,
  token       VARCHAR(64) NOT NULL UNIQUE,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_pas_surveys_owner ON program_admin_surveys (owner_id);
CREATE INDEX IF NOT EXISTS idx_pas_surveys_template ON program_admin_surveys (template_id);

-- One submission per (program-survey, website_user). Farmers can take many
-- programs' surveys, but each program's survey only once.
CREATE TABLE IF NOT EXISTS program_admin_survey_submissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id       UUID NOT NULL REFERENCES program_admin_surveys (id) ON DELETE CASCADE,
  website_user_id UUID NOT NULL REFERENCES website_users (id) ON DELETE CASCADE,
  first_name      VARCHAR(150),
  last_name       VARCHAR(150),
  farm_name       VARCHAR(200),
  referral_source VARCHAR(200),
  state           VARCHAR(100),
  total_acres     DECIMAL(10, 2),
  answers         JSONB NOT NULL DEFAULT '[]',
  score           INT NOT NULL DEFAULT 0,
  auto_category   VARCHAR(20) NOT NULL DEFAULT 'not_qualified',
  final_category  VARCHAR(20) NOT NULL DEFAULT 'not_qualified',
  status          VARCHAR(30) NOT NULL DEFAULT 'submitted',
  status_token    VARCHAR(64),
  override_reason TEXT,
  reviewed_by     UUID,
  reviewed_at     TIMESTAMPTZ,
  enrollment_id   VARCHAR(30),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_pas_submissions_survey ON program_admin_survey_submissions (survey_id);
CREATE INDEX IF NOT EXISTS idx_pas_submissions_user ON program_admin_survey_submissions (website_user_id);
CREATE INDEX IF NOT EXISTS idx_pas_submissions_status_token ON program_admin_survey_submissions (status_token);
-- One live submission per program per user (drafts included). Excludes soft-deleted.
CREATE UNIQUE INDEX IF NOT EXISTS uq_pas_submission_survey_user
  ON program_admin_survey_submissions (survey_id, website_user_id)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS program_admin_survey_contracts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id     UUID NOT NULL REFERENCES program_admin_survey_submissions (id) ON DELETE CASCADE,
  token             VARCHAR(64) NOT NULL,
  token_expires_at  TIMESTAMPTZ NOT NULL,
  template_version  VARCHAR(20) NOT NULL DEFAULT 'v1',
  signed_name       VARCHAR(150),
  signature_url     TEXT,
  signed_at         TIMESTAMPTZ,
  signer_ip         VARCHAR(64),
  signer_user_agent TEXT,
  accepted_by       UUID,
  accepted_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pas_contracts_submission ON program_admin_survey_contracts (submission_id);
CREATE INDEX IF NOT EXISTS idx_pas_contracts_token ON program_admin_survey_contracts (token);
