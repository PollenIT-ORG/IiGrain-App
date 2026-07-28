-- 034_survey_categories_scale.sql
-- Reworks the eligibility survey into a category-based assessment with a 0-3
-- scale per question (Not at all / small / moderate / great extent), managed
-- from the admin panel. Also adds the extra basic-detail fields and a draft
-- status so a producer can save and resume by email.

-- Categories a question belongs to (Soil Health, Water Management, ...).
CREATE TABLE IF NOT EXISTS survey_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(150) NOT NULL,
  description TEXT,
  icon        VARCHAR(50),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_survey_categories_order
  ON survey_categories (sort_order) WHERE deleted_at IS NULL;

-- Questions now belong to a category and are answered on a 0-3 scale. The score
-- for a question is (answer value 0..3) * weight.
ALTER TABLE survey_questions
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES survey_categories(id) ON DELETE CASCADE;
ALTER TABLE survey_questions
  ADD COLUMN IF NOT EXISTS weight INTEGER NOT NULL DEFAULT 1;

-- The old yes/no questions do not fit the new 0-3 model, so retire them.
UPDATE survey_questions SET deleted_at = now(), updated_at = now()
  WHERE deleted_at IS NULL AND category_id IS NULL;

-- Extra basic details captured on the assessment, and a draft status so partial
-- progress can be saved and resumed.
ALTER TABLE eligibility_submissions
  ADD COLUMN IF NOT EXISTS first_name      VARCHAR(150);
ALTER TABLE eligibility_submissions
  ADD COLUMN IF NOT EXISTS last_name       VARCHAR(150);
ALTER TABLE eligibility_submissions
  ADD COLUMN IF NOT EXISTS farm_name       VARCHAR(200);
ALTER TABLE eligibility_submissions
  ADD COLUMN IF NOT EXISTS referral_source VARCHAR(200);

-- Allow the 'draft' status (partial, not yet submitted).
ALTER TABLE eligibility_submissions DROP CONSTRAINT IF EXISTS chk_submission_status;
ALTER TABLE eligibility_submissions ADD CONSTRAINT chk_submission_status CHECK (status IN (
  'draft','submitted','not_qualified','qualified','contract_sent','contract_signed','enrolled'
));

-- Draft submissions have no score yet, so total_acres / state can be null while
-- a producer is mid-way. Relax those NOT NULLs.
ALTER TABLE eligibility_submissions ALTER COLUMN state DROP NOT NULL;
ALTER TABLE eligibility_submissions ALTER COLUMN total_acres DROP NOT NULL;

-- Seed the 9 categories from the program design. Idempotent by name.
INSERT INTO survey_categories (name, description, icon, sort_order)
SELECT * FROM (VALUES
  ('Soil Health', 'These questions help us understand the practices you use to build and maintain healthy soil.', 'soil', 0),
  ('Water Management', 'How you manage water use, drainage and irrigation on your land.', 'water', 1),
  ('Nutrient Management', 'How you plan and apply nutrients to your crops.', 'nutrient', 2),
  ('Tillage & Land Management', 'Your approach to tillage and working the land.', 'tillage', 3),
  ('Crop Diversity & Rotation', 'The variety of crops you grow and how you rotate them.', 'crop', 4),
  ('Pest Management', 'How you monitor and manage pests, weeds and disease.', 'pest', 5),
  ('Cover Crops & Residue Management', 'Your use of cover crops and how you handle crop residue.', 'cover', 6),
  ('Habitat & Biodiversity', 'How you support wildlife habitat and biodiversity on your farm.', 'habitat', 7),
  ('Record Keeping & Continuous Improvement', 'How you record data and improve your practices over time.', 'record', 8)
) AS v(name, description, icon, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM survey_categories WHERE deleted_at IS NULL);

-- Seed questions for each category (0-3 scale, weight 1). Idempotent guard.
DO $$
DECLARE
  c_soil    UUID; c_water UUID; c_nutrient UUID; c_tillage UUID; c_crop UUID;
  c_pest    UUID; c_cover UUID; c_habitat  UUID; c_record  UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM survey_questions WHERE category_id IS NOT NULL AND deleted_at IS NULL) THEN
    RETURN;
  END IF;

  SELECT id INTO c_soil     FROM survey_categories WHERE name = 'Soil Health' AND deleted_at IS NULL;
  SELECT id INTO c_water    FROM survey_categories WHERE name = 'Water Management' AND deleted_at IS NULL;
  SELECT id INTO c_nutrient FROM survey_categories WHERE name = 'Nutrient Management' AND deleted_at IS NULL;
  SELECT id INTO c_tillage  FROM survey_categories WHERE name = 'Tillage & Land Management' AND deleted_at IS NULL;
  SELECT id INTO c_crop     FROM survey_categories WHERE name = 'Crop Diversity & Rotation' AND deleted_at IS NULL;
  SELECT id INTO c_pest     FROM survey_categories WHERE name = 'Pest Management' AND deleted_at IS NULL;
  SELECT id INTO c_cover    FROM survey_categories WHERE name = 'Cover Crops & Residue Management' AND deleted_at IS NULL;
  SELECT id INTO c_habitat  FROM survey_categories WHERE name = 'Habitat & Biodiversity' AND deleted_at IS NULL;
  SELECT id INTO c_record   FROM survey_categories WHERE name = 'Record Keeping & Continuous Improvement' AND deleted_at IS NULL;

  INSERT INTO survey_questions (category_id, question_text, help_text, sort_order, score_yes, score_no) VALUES
  (c_soil, 'To what extent do you test your soil on a regular basis?', 'Regular soil testing helps you track soil health over time.', 0, 0, 0),
  (c_soil, 'To what extent do you add organic matter to your soil (manure, compost, cover crops, etc.)?', NULL, 1, 0, 0),
  (c_soil, 'To what extent do you minimize soil erosion on your fields?', NULL, 2, 0, 0),
  (c_soil, 'To what extent do you keep your soil covered through the year?', NULL, 3, 0, 0),
  (c_soil, 'To what extent do you avoid soil compaction from machinery?', NULL, 4, 0, 0),
  (c_soil, 'To what extent do you use practices that build soil biology?', NULL, 5, 0, 0),

  (c_water, 'To what extent do you manage water use efficiently on your land?', NULL, 0, 0, 0),
  (c_water, 'To what extent do you protect water quality on and around your fields?', NULL, 1, 0, 0),
  (c_water, 'To what extent do you manage drainage to reduce runoff?', NULL, 2, 0, 0),

  (c_nutrient, 'To what extent do you plan nutrient applications based on crop need?', NULL, 0, 0, 0),
  (c_nutrient, 'To what extent do you use organic or slow-release nutrient sources?', NULL, 1, 0, 0),
  (c_nutrient, 'To what extent do you avoid over-applying fertiliser?', NULL, 2, 0, 0),
  (c_nutrient, 'To what extent do you account for nutrients already in the soil?', NULL, 3, 0, 0),

  (c_tillage, 'To what extent do you practise reduced or no-till farming?', NULL, 0, 0, 0),
  (c_tillage, 'To what extent do you leave crop residue on the surface?', NULL, 1, 0, 0),
  (c_tillage, 'To what extent do you avoid working wet soils?', NULL, 2, 0, 0),

  (c_crop, 'To what extent do you rotate your crops across seasons?', NULL, 0, 0, 0),
  (c_crop, 'To what extent do you grow a diverse range of crops?', NULL, 1, 0, 0),

  (c_pest, 'To what extent do you use integrated pest management?', NULL, 0, 0, 0),
  (c_pest, 'To what extent do you minimise chemical pesticide use?', NULL, 1, 0, 0),

  (c_cover, 'To what extent do you plant cover crops between main crops?', NULL, 0, 0, 0),
  (c_cover, 'To what extent do you keep living roots in the ground year-round?', NULL, 1, 0, 0),
  (c_cover, 'To what extent do you retain crop residue rather than burning or removing it?', NULL, 2, 0, 0),

  (c_habitat, 'To what extent do you maintain habitat areas (hedgerows, margins, ponds)?', NULL, 0, 0, 0),
  (c_habitat, 'To what extent do you support pollinators and beneficial wildlife?', NULL, 1, 0, 0),

  (c_record, 'To what extent do you keep records of your field practices?', NULL, 0, 0, 0),
  (c_record, 'To what extent do you review your data to improve practices?', NULL, 1, 0, 0),
  (c_record, 'To what extent do you set goals for continuous improvement?', NULL, 2, 0, 0);
END$$;

-- Re-band for a 0-3 scale. Max possible = 28 questions * 3 = 84. Reset bands to
-- sensible thresholds for the new scale.
UPDATE survey_scoring_rules SET min_score = 63, max_score = 1000 WHERE category = 'gold';
UPDATE survey_scoring_rules SET min_score = 42, max_score = 62   WHERE category = 'silver';
UPDATE survey_scoring_rules SET min_score = 25, max_score = 41   WHERE category = 'bronze';
UPDATE survey_scoring_rules SET min_score = 0,  max_score = 24   WHERE category = 'not_qualified';
