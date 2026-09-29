-- ===========================================================================
-- An input based category is one form, and the farmer or the assessor can
-- fill that form in more than once: three trainings are three records of the
-- Trainings form. Each record holds its own answers. Multiple choice
-- assessments keep a single answer per question, with no record.
--
-- Every form also ends with an optional evidence upload: a record carries its
-- own, and a multiple choice category keeps one for the whole category.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS assessment_records (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id     UUID NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  program_id   UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  category_id  UUID NOT NULL REFERENCES assessment_categories(id) ON DELETE CASCADE,
  author_role  VARCHAR(20) NOT NULL DEFAULT 'farmer',
  author_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  -- The evidence uploaded at the end of the form, for this record.
  evidence_urls TEXT[] NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_assessment_records_owner
  ON assessment_records (field_id, program_id, author_role, category_id)
  WHERE deleted_at IS NULL;

ALTER TABLE assessment_responses
  ADD COLUMN IF NOT EXISTS record_id UUID REFERENCES assessment_records(id) ON DELETE CASCADE;

-- The templates whose categories are forms: marked input based, or unmarked
-- but holding a field that is not a scored or multiple choice question.
CREATE TEMP TABLE input_templates ON COMMIT DROP AS
SELECT t.id
  FROM assessment_templates t
 WHERE t.question_kind = 'input'
    OR (t.question_kind IS NULL AND EXISTS (
          SELECT 1
            FROM assessment_categories c
            JOIN assessment_questions q ON q.category_id = c.id AND q.deleted_at IS NULL
           WHERE c.template_id = t.id
             AND q.question_type NOT IN ('scored', 'mcq')));

-- Answers already given to a form become its first record.
INSERT INTO assessment_records (field_id, program_id, category_id, author_role, author_id, sort_order, created_at, updated_at)
SELECT ar.field_id,
       ar.program_id,
       aq.category_id,
       ar.author_role,
       (array_agg(ar.author_id ORDER BY ar.created_at) FILTER (WHERE ar.author_id IS NOT NULL))[1],
       0,
       MIN(ar.created_at),
       now()
  FROM assessment_responses ar
  JOIN assessment_questions aq ON aq.id = ar.question_id
  JOIN assessment_categories ac ON ac.id = aq.category_id
 WHERE ar.deleted_at IS NULL
   AND ar.record_id IS NULL
   AND ac.template_id IN (SELECT id FROM input_templates)
 GROUP BY ar.field_id, ar.program_id, ar.author_role, aq.category_id;

UPDATE assessment_responses ar
   SET record_id = r.id
  FROM assessment_questions aq, assessment_categories ac, assessment_records r
 WHERE aq.id = ar.question_id
   AND ac.id = aq.category_id
   AND ac.template_id IN (SELECT id FROM input_templates)
   AND r.field_id = ar.field_id
   AND r.program_id = ar.program_id
   AND r.author_role = ar.author_role
   AND r.category_id = aq.category_id
   AND r.deleted_at IS NULL
   AND ar.record_id IS NULL
   AND ar.deleted_at IS NULL;

-- One answer per question for a multiple choice assessment, and one answer
-- per question inside each record of a form.
DROP INDEX IF EXISTS uq_assessment_responses_field_question_role_program;

CREATE UNIQUE INDEX IF NOT EXISTS uq_assessment_responses_single
  ON assessment_responses (field_id, question_id, author_role, program_id)
  WHERE deleted_at IS NULL AND record_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_assessment_responses_record_question
  ON assessment_responses (record_id, question_id)
  WHERE deleted_at IS NULL AND record_id IS NOT NULL;

-- The evidence uploaded at the end of a multiple choice category.
CREATE TABLE IF NOT EXISTS assessment_category_evidence (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id      UUID NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  program_id    UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  category_id   UUID NOT NULL REFERENCES assessment_categories(id) ON DELETE CASCADE,
  author_role   VARCHAR(20) NOT NULL DEFAULT 'farmer',
  author_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  evidence_urls TEXT[] NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_assessment_category_evidence
  ON assessment_category_evidence (field_id, program_id, author_role, category_id)
  WHERE deleted_at IS NULL;

-- A new field asks for no evidence and no description until the admin turns them on.
ALTER TABLE assessment_questions
  ALTER COLUMN evidence_mode SET DEFAULT 'off',
  ALTER COLUMN comment_mode SET DEFAULT 'off';
