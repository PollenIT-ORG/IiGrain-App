-- Assessment templates: the existing question bank becomes the Original template and Global starts as its copy.

CREATE TABLE IF NOT EXISTS assessment_templates (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id       UUID,
  is_global      BOOLEAN NOT NULL DEFAULT false,
  program_id     UUID REFERENCES programs (id) ON DELETE SET NULL,
  copied_from_id UUID,
  name           VARCHAR(150) NOT NULL,
  description    TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_by     UUID,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_assessment_templates_owner ON assessment_templates (owner_id);
CREATE INDEX IF NOT EXISTS idx_assessment_templates_global ON assessment_templates (is_global);

-- A program has at most one live copy of its own.
CREATE UNIQUE INDEX IF NOT EXISTS uq_assessment_templates_program
  ON assessment_templates (program_id)
  WHERE deleted_at IS NULL AND program_id IS NOT NULL;

-- Only one live Global template at a time.
CREATE UNIQUE INDEX IF NOT EXISTS uq_assessment_templates_global
  ON assessment_templates (is_global)
  WHERE is_global AND deleted_at IS NULL;

-- Names are unique per owner; platform templates share the null owner group and program copies are exempt.
CREATE UNIQUE INDEX IF NOT EXISTS uq_assessment_templates_owner_name
  ON assessment_templates (COALESCE(owner_id, '00000000-0000-0000-0000-000000000000'::uuid), LOWER(name))
  WHERE deleted_at IS NULL AND program_id IS NULL;

ALTER TABLE assessment_categories ADD COLUMN IF NOT EXISTS template_id UUID;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS assessment_template_id UUID;

-- Every existing category and program, deleted ones included, moves under the Original template.
DO $$
DECLARE
  original_id CONSTANT uuid := overlay(overlay(md5('assessment_template:original') placing '4' from 13 for 1) placing '8' from 17 for 1)::uuid;
BEGIN
  INSERT INTO assessment_templates (id, owner_id, is_global, name, description)
  VALUES (original_id, NULL, false, 'Original assessment',
          'The questions programs used before templates, kept as they were so earlier answers and scores stay intact.')
  ON CONFLICT (id) DO NOTHING;

  UPDATE assessment_categories SET template_id = original_id WHERE template_id IS NULL;
  UPDATE programs SET assessment_template_id = original_id WHERE assessment_template_id IS NULL;
END $$;

-- Category names were unique across the whole bank and are now unique inside each template.
DROP INDEX IF EXISTS uq_assessment_categories_name_alive;

CREATE UNIQUE INDEX IF NOT EXISTS uq_assessment_categories_template_name_alive
  ON assessment_categories (template_id, LOWER(name))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_assessment_categories_template ON assessment_categories (template_id);

-- Global starts as a copy of the live Original categories and questions, with fixed ids so a rerun adds nothing.
DO $$
DECLARE
  original_id CONSTANT uuid := overlay(overlay(md5('assessment_template:original') placing '4' from 13 for 1) placing '8' from 17 for 1)::uuid;
  global_id   CONSTANT uuid := overlay(overlay(md5('assessment_template:global') placing '4' from 13 for 1) placing '8' from 17 for 1)::uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM assessment_templates WHERE is_global AND deleted_at IS NULL) THEN
    RETURN;
  END IF;

  INSERT INTO assessment_templates (id, owner_id, is_global, copied_from_id, name, description)
  VALUES (global_id, NULL, true, original_id, 'Global', 'The template new programs start from.')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO assessment_categories (id, template_id, name, description, sort_order, is_active)
  SELECT overlay(overlay(md5('assessment_template:global:category:' || c.id::text) placing '4' from 13 for 1) placing '8' from 17 for 1)::uuid,
         global_id, c.name, c.description, c.sort_order, c.is_active
    FROM assessment_categories c
   WHERE c.template_id = original_id AND c.deleted_at IS NULL
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO assessment_questions (
    id, category_id, question_code, question_text, guidance_note,
    score0_description, score1_description, score2_description, score3_description,
    sort_order, is_active
  )
  SELECT overlay(overlay(md5('assessment_template:global:question:' || q.id::text) placing '4' from 13 for 1) placing '8' from 17 for 1)::uuid,
         overlay(overlay(md5('assessment_template:global:category:' || q.category_id::text) placing '4' from 13 for 1) placing '8' from 17 for 1)::uuid,
         q.question_code, q.question_text, q.guidance_note,
         q.score0_description, q.score1_description, q.score2_description, q.score3_description,
         q.sort_order, q.is_active
    FROM assessment_questions q
    JOIN assessment_categories c ON c.id = q.category_id AND c.deleted_at IS NULL
   WHERE c.template_id = original_id AND q.deleted_at IS NULL
  ON CONFLICT (id) DO NOTHING;
END $$;

ALTER TABLE assessment_categories ALTER COLUMN template_id SET NOT NULL;
ALTER TABLE programs ALTER COLUMN assessment_template_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_assessment_categories_template') THEN
    ALTER TABLE assessment_categories
      ADD CONSTRAINT fk_assessment_categories_template
      FOREIGN KEY (template_id) REFERENCES assessment_templates (id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_programs_assessment_template') THEN
    ALTER TABLE programs
      ADD CONSTRAINT fk_programs_assessment_template
      FOREIGN KEY (assessment_template_id) REFERENCES assessment_templates (id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_programs_assessment_template ON programs (assessment_template_id);
