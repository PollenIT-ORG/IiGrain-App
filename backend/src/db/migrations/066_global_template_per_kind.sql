-- ===========================================================================
-- Multiple choice and input based each have their own Global template. A
-- Global template now records its kind, and one of each kind is allowed
-- instead of one in all.
-- ===========================================================================

-- A Global made before templates said their kind gets the one its questions show.
UPDATE assessment_templates t
   SET question_kind = CASE WHEN EXISTS (
         SELECT 1
           FROM assessment_questions q
           JOIN assessment_categories c ON c.id = q.category_id AND c.deleted_at IS NULL
          WHERE c.template_id = t.id AND q.deleted_at IS NULL
            AND q.question_type NOT IN ('scored', 'mcq')) THEN 'input' ELSE 'mcq' END,
       updated_at = now()
 WHERE t.is_global AND t.question_kind IS NULL;

DROP INDEX IF EXISTS uq_assessment_templates_global;

CREATE UNIQUE INDEX IF NOT EXISTS uq_assessment_templates_global_kind
  ON assessment_templates (question_kind)
  WHERE is_global AND deleted_at IS NULL;
