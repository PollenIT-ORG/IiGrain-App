-- A farmer's answer to one assessment question, for one field.
-- One assessment = one field (per-field scope). Each row is a single answered
-- question with its score (0-3). Progress for a field/category is derived by
-- counting these rows against the count of active questions.
CREATE TABLE IF NOT EXISTS assessment_responses (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id    UUID        NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  question_id UUID        NOT NULL REFERENCES assessment_questions(id) ON DELETE CASCADE,
  -- The selected score: 0 = none/conventional ... 3 = advanced/regenerative.
  score       SMALLINT    NOT NULL CHECK (score BETWEEN 0 AND 3),
  -- Optional free-text evidence/comments the farmer adds with the score.
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

-- One live answer per (field, question): a field can't answer the same question
-- twice. Partial so a soft-deleted answer doesn't block re-answering.
CREATE UNIQUE INDEX IF NOT EXISTS uq_assessment_responses_field_question
  ON assessment_responses (field_id, question_id)
  WHERE deleted_at IS NULL;

-- Fast progress lookups: all live answers for a field.
CREATE INDEX IF NOT EXISTS idx_assessment_responses_field
  ON assessment_responses (field_id)
  WHERE deleted_at IS NULL;
