-- Hand run only: undoes 059_assessment_templates.sql and stops if any answer uses a question outside the Original template.

BEGIN;

DO $$
DECLARE
  original_id CONSTANT uuid := overlay(overlay(md5('assessment_template:original') placing '4' from 13 for 1) placing '8' from 17 for 1)::uuid;
BEGIN
  IF EXISTS (
    SELECT 1
      FROM assessment_responses r
      JOIN assessment_questions q ON q.id = r.question_id
      JOIN assessment_categories c ON c.id = q.category_id
     WHERE c.template_id <> original_id
  ) THEN
    RAISE EXCEPTION 'Answers exist on questions outside the Original template; rolling back would delete them.';
  END IF;

  DELETE FROM assessment_questions q
   USING assessment_categories c
   WHERE q.category_id = c.id AND c.template_id <> original_id;

  DELETE FROM assessment_categories WHERE template_id <> original_id;
END $$;

ALTER TABLE programs DROP CONSTRAINT IF EXISTS fk_programs_assessment_template;
ALTER TABLE assessment_categories DROP CONSTRAINT IF EXISTS fk_assessment_categories_template;

DROP INDEX IF EXISTS idx_programs_assessment_template;
ALTER TABLE programs DROP COLUMN IF EXISTS assessment_template_id;

DROP INDEX IF EXISTS uq_assessment_categories_template_name_alive;
DROP INDEX IF EXISTS idx_assessment_categories_template;
ALTER TABLE assessment_categories DROP COLUMN IF EXISTS template_id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_assessment_categories_name_alive
  ON assessment_categories (LOWER(name))
  WHERE deleted_at IS NULL;

DROP TABLE IF EXISTS assessment_templates;

DELETE FROM _migrations WHERE filename = '059_assessment_templates.sql';

COMMIT;
