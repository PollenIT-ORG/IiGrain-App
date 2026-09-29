-- ===========================================================================
-- A name given while setting up a program's assessment now goes on the
-- program's own assessment. Before this, the name went on a separate template
-- that stayed empty while the program filled in its own copy, so the list
-- showed 0 categories and 0 questions for it.
--
-- Each such pair becomes one: the program's assessment takes the name, and the
-- empty template it was copied from is removed. Only an empty, non Global
-- template that exactly one live program assessment was copied from, and that
-- no program uses directly, is merged.
-- ===========================================================================

CREATE TEMP TABLE named_merges ON COMMIT DROP AS
SELECT t.id              AS template_id,
       t.name,
       t.description,
       t.copied_from_id  AS source_id,
       c.id              AS copy_id
  FROM assessment_templates t
  JOIN assessment_templates c
         ON c.copied_from_id = t.id
        AND c.deleted_at IS NULL
        AND c.program_id IS NOT NULL
  JOIN programs pr
         ON pr.id = c.program_id
        AND pr.deleted_at IS NULL
        AND pr.assessment_template_id = c.id
 WHERE t.deleted_at IS NULL
   AND t.program_id IS NULL
   AND t.is_global = false
   AND NOT EXISTS (SELECT 1 FROM assessment_categories ac
                    WHERE ac.template_id = t.id AND ac.deleted_at IS NULL)
   AND NOT EXISTS (SELECT 1 FROM programs p2 WHERE p2.assessment_template_id = t.id)
   AND (SELECT COUNT(*) FROM assessment_templates c2
         WHERE c2.copied_from_id = t.id AND c2.deleted_at IS NULL) = 1;

-- The program's assessment takes the name and starts from what the template started from.
UPDATE assessment_templates c
   SET name = m.name,
       description = COALESCE(c.description, m.description),
       copied_from_id = m.source_id,
       updated_at = now()
  FROM named_merges m
 WHERE c.id = m.copy_id;

UPDATE assessment_templates t
   SET deleted_at = now(),
       updated_at = now()
  FROM named_merges m
 WHERE t.id = m.template_id;
