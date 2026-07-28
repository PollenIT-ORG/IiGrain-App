-- 030_eligibility_enrollment.sql
-- Step 1 (Eligibility Survey) and Step 2 (Contract Signing), which happen on the
-- public website before a producer is allowed to register in the mobile app.
--
-- Website accounts live in their own table on purpose: someone who does not
-- qualify must never end up in `users`, and the mobile app's auth stays
-- untouched. A `users` row is only created later, when the person registers in
-- the app with their Enrollment ID.

-- People who signed up on the website to take the survey.
CREATE TABLE IF NOT EXISTS website_users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name         VARCHAR(150) NOT NULL,
  email             VARCHAR(255) NOT NULL,
  password_hash     TEXT NOT NULL,
  phone             VARCHAR(20),
  is_email_verified BOOLEAN NOT NULL DEFAULT false,
  last_login_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

-- One live account per email address.
CREATE UNIQUE INDEX IF NOT EXISTS uq_website_users_email
  ON website_users (lower(email)) WHERE deleted_at IS NULL;

-- The questions shown in the survey. Managed from the admin panel, so the
-- program team can change them without a release. A row with parent_question_id
-- is a follow-up, shown only when the parent was answered a particular way.
CREATE TABLE IF NOT EXISTS survey_questions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_text           TEXT NOT NULL,
  help_text               TEXT,
  score_yes               INTEGER NOT NULL DEFAULT 0,
  score_no                INTEGER NOT NULL DEFAULT 0,
  parent_question_id      UUID REFERENCES survey_questions(id) ON DELETE CASCADE,
  show_when_parent_answer VARCHAR(10),
  sort_order              INTEGER NOT NULL DEFAULT 0,
  is_active               BOOLEAN NOT NULL DEFAULT true,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at              TIMESTAMPTZ,
  CONSTRAINT chk_survey_parent_answer
    CHECK (show_when_parent_answer IS NULL OR show_when_parent_answer IN ('yes','no'))
);

CREATE INDEX IF NOT EXISTS idx_survey_questions_order
  ON survey_questions (sort_order) WHERE deleted_at IS NULL;

-- Score bands. Editable so the thresholds are never hard-coded in the app.
CREATE TABLE IF NOT EXISTS survey_scoring_rules (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category   VARCHAR(20) NOT NULL,
  min_score  INTEGER NOT NULL,
  max_score  INTEGER NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_scoring_category
    CHECK (category IN ('gold','silver','bronze','not_qualified'))
);

-- One survey submission per website user (enforced by the unique index below).
CREATE TABLE IF NOT EXISTS eligibility_submissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_user_id UUID NOT NULL REFERENCES website_users(id) ON DELETE CASCADE,
  state           VARCHAR(100) NOT NULL,
  total_acres     NUMERIC(10,2) NOT NULL,
  -- [{ questionId, answer, score }] as answered, so a later question edit does
  -- not rewrite history.
  answers         JSONB NOT NULL DEFAULT '[]'::jsonb,
  score           INTEGER NOT NULL DEFAULT 0,
  auto_category   VARCHAR(20) NOT NULL,
  -- What the rest of the flow uses. Starts equal to auto_category; an admin may
  -- override it before the contract goes out.
  final_category  VARCHAR(20) NOT NULL,
  status          VARCHAR(30) NOT NULL DEFAULT 'submitted',
  reviewed_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at     TIMESTAMPTZ,
  enrollment_id   VARCHAR(30),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  CONSTRAINT chk_submission_status CHECK (status IN (
    'submitted','not_qualified','qualified','contract_sent','contract_signed','enrolled'
  ))
);

-- Duplicate rule: one live submission per website account.
CREATE UNIQUE INDEX IF NOT EXISTS uq_submission_per_user
  ON eligibility_submissions (website_user_id) WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_submission_enrollment_id
  ON eligibility_submissions (enrollment_id) WHERE enrollment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_submissions_status
  ON eligibility_submissions (status, created_at DESC) WHERE deleted_at IS NULL;

-- The contract sent for a submission, and the signature captured back.
CREATE TABLE IF NOT EXISTS contracts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id    UUID NOT NULL REFERENCES eligibility_submissions(id) ON DELETE CASCADE,
  -- Random token used in the emailed signing link.
  token            VARCHAR(64) NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  template_version VARCHAR(20) NOT NULL DEFAULT 'v1',
  signed_name      VARCHAR(150),
  -- Cloudinary URL when the producer drew their signature.
  signature_url    TEXT,
  signed_at        TIMESTAMPTZ,
  -- Audit trail captured at the moment of signing.
  signer_ip        VARCHAR(64),
  signer_user_agent TEXT,
  accepted_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  accepted_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_contracts_token ON contracts (token);
CREATE INDEX IF NOT EXISTS idx_contracts_submission ON contracts (submission_id);

-- Messages from the website contact form.
CREATE TABLE IF NOT EXISTS contact_enquiries (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(150) NOT NULL,
  email      VARCHAR(255) NOT NULL,
  phone      VARCHAR(20),
  subject    VARCHAR(150),
  message    TEXT NOT NULL,
  is_read    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_contact_enquiries_new
  ON contact_enquiries (created_at DESC) WHERE deleted_at IS NULL;

-- Set when the producer registers in the mobile app with their Enrollment ID.
-- Added now so the data is ready; the mobile registration change comes later.
ALTER TABLE users ADD COLUMN IF NOT EXISTS enrollment_id VARCHAR(30);
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_enrollment_id
  ON users (enrollment_id) WHERE enrollment_id IS NOT NULL;

-- Default score bands so the survey works out of the box. The program team can
-- change these from the admin panel.
INSERT INTO survey_scoring_rules (category, min_score, max_score)
SELECT * FROM (VALUES
  ('gold', 80, 1000),
  ('silver', 60, 79),
  ('bronze', 40, 59),
  ('not_qualified', 0, 39)
) AS v(category, min_score, max_score)
WHERE NOT EXISTS (SELECT 1 FROM survey_scoring_rules);
