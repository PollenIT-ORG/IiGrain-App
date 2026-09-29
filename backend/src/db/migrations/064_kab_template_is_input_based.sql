-- ===========================================================================
-- The KAB template was added before a template could say which kind of
-- questions it holds, so it reads as mixed. It is a set of forms, so it is
-- marked input based. A template someone has already set by hand is left alone.
-- ===========================================================================

UPDATE assessment_templates
   SET question_kind = 'input',
       description = 'Field monitoring worksheet from KAB: nine forms covering the farm profile, trainings, soil samples and the practices a field is scored on.',
       updated_at = now()
 WHERE id = '7543c799-6e90-48b6-895f-312265626b7a'::uuid
   AND question_kind IS NULL;
