-- ===========================================================================
-- Assessment question types, choices for MCQ questions, the admin review that
-- sets the final score, and the survey and template locks.
--
-- Questions written before this keep the 0 to 3 scored type, so the programs,
-- answers and apps already in use carry on unchanged.
-- ===========================================================================

ALTER TABLE assessment_questions
  ADD COLUMN IF NOT EXISTS question_type VARCHAR(20) NOT NULL DEFAULT 'scored',
  -- The highest score this question can reach, used for the percentage.
  ADD COLUMN IF NOT EXISTS max_score SMALLINT NOT NULL DEFAULT 3;

ALTER TABLE assessment_questions
  DROP CONSTRAINT IF EXISTS chk_assessment_questions_type;
ALTER TABLE assessment_questions
  ADD CONSTRAINT chk_assessment_questions_type
  CHECK (question_type IN ('scored', 'mcq', 'text', 'long_text', 'number', 'date', 'boolean', 'photo'));

ALTER TABLE assessment_questions
  DROP CONSTRAINT IF EXISTS chk_assessment_questions_max_score;
ALTER TABLE assessment_questions
  ADD CONSTRAINT chk_assessment_questions_max_score
  CHECK (max_score BETWEEN 1 AND 100);

-- The choices of an MCQ question. Each choice carries the score it gives.
CREATE TABLE IF NOT EXISTS assessment_question_options (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID         NOT NULL REFERENCES assessment_questions(id) ON DELETE CASCADE,
  option_text VARCHAR(300) NOT NULL,
  score       SMALLINT     NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  sort_order  INTEGER      NOT NULL DEFAULT 0,
  is_active   BOOLEAN      NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_assessment_question_options_question
  ON assessment_question_options (question_id, sort_order)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Answers: the value the farmer gave, kept in the column that fits its type,
-- and the score an admin gives it during review.
-- ---------------------------------------------------------------------------

ALTER TABLE assessment_responses
  ADD COLUMN IF NOT EXISTS option_id      UUID REFERENCES assessment_question_options(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS answer_text    TEXT,
  ADD COLUMN IF NOT EXISTS answer_number  NUMERIC(14, 4),
  ADD COLUMN IF NOT EXISTS answer_date    DATE,
  ADD COLUMN IF NOT EXISTS answer_boolean BOOLEAN,
  ADD COLUMN IF NOT EXISTS review_score   SMALLINT,
  ADD COLUMN IF NOT EXISTS reviewed_by    UUID REFERENCES users(id) ON UPDATE NO ACTION,
  ADD COLUMN IF NOT EXISTS reviewed_at    TIMESTAMPTZ;

-- An input based answer has no score of its own until the review gives it one.
ALTER TABLE assessment_responses ALTER COLUMN score DROP NOT NULL;

-- An MCQ choice can be worth more than 3, so the old 0 to 3 ceiling is lifted.
ALTER TABLE assessment_responses DROP CONSTRAINT IF EXISTS assessment_responses_score_check;
ALTER TABLE assessment_responses DROP CONSTRAINT IF EXISTS chk_assessment_responses_score;
ALTER TABLE assessment_responses
  ADD CONSTRAINT chk_assessment_responses_score
  CHECK (score IS NULL OR score BETWEEN 0 AND 100);

ALTER TABLE assessment_responses DROP CONSTRAINT IF EXISTS chk_assessment_responses_review_score;
ALTER TABLE assessment_responses
  ADD CONSTRAINT chk_assessment_responses_review_score
  CHECK (review_score IS NULL OR review_score BETWEEN 0 AND 100);

CREATE INDEX IF NOT EXISTS idx_assessment_responses_option
  ON assessment_responses (option_id)
  WHERE deleted_at IS NULL AND option_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Review: a submitted assessment waits for an admin before its score counts.
-- Assessments submitted before this are already counted, so they stay approved.
-- ---------------------------------------------------------------------------

ALTER TABLE field_assessments
  ADD COLUMN IF NOT EXISTS review_status VARCHAR(20) NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS reviewed_by   UUID REFERENCES users(id) ON UPDATE NO ACTION,
  ADD COLUMN IF NOT EXISTS reviewed_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_note   TEXT;

ALTER TABLE field_assessments DROP CONSTRAINT IF EXISTS chk_field_assessments_review_status;
ALTER TABLE field_assessments
  ADD CONSTRAINT chk_field_assessments_review_status
  CHECK (review_status IN ('in_review', 'approved'));

CREATE INDEX IF NOT EXISTS idx_field_assessments_review
  ON field_assessments (review_status, submitted_at DESC)
  WHERE status = 'submitted';

-- ---------------------------------------------------------------------------
-- Locks: the survey lock opens the assessment to farmers, the template lock
-- freezes the questions.
-- ---------------------------------------------------------------------------

ALTER TABLE assessment_templates
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_by UUID REFERENCES users(id) ON UPDATE NO ACTION;

ALTER TABLE program_admin_surveys
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_by UUID REFERENCES users(id) ON UPDATE NO ACTION;

-- Surveys running before this rule were already open to farmers, so they stay open.
UPDATE program_admin_surveys
   SET locked_at = now()
 WHERE locked_at IS NULL
   AND deleted_at IS NULL;
