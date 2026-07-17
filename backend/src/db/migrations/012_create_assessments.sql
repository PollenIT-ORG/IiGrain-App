-- Assessment categories (sections like "Animal Welfare", "Biodiversity & Habitat", etc.)
CREATE TABLE IF NOT EXISTS assessment_categories (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(150) NOT NULL,
  description TEXT,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_assessment_categories_alive
  ON assessment_categories (sort_order)
  WHERE deleted_at IS NULL;

-- Assessment questions within a category
CREATE TABLE IF NOT EXISTS assessment_questions (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id         UUID        NOT NULL REFERENCES assessment_categories(id) ON DELETE CASCADE,
  question_code       VARCHAR(20),
  question_text       TEXT        NOT NULL,
  guidance_note       TEXT,
  score0_description  TEXT,
  score1_description  TEXT,
  score2_description  TEXT,
  score3_description  TEXT,
  sort_order          INTEGER     NOT NULL DEFAULT 0,
  is_active           BOOLEAN     NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_assessment_questions_category
  ON assessment_questions (category_id, sort_order)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_assessment_questions_alive
  ON assessment_questions (id)
  WHERE deleted_at IS NULL;
