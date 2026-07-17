-- ============================================================================
-- FIX: PUT /assessments/my/fields/:fieldId/questions/:questionId/answer → 500
--
--   Postgres error 42P10:
--   "there is no unique or exclusion constraint matching the ON CONFLICT
--    specification"
--     at upsertResponse (src/models/assessmentMobile.model.ts)
--
-- CAUSE
--   upsertResponse() does:
--     INSERT INTO assessment_responses (field_id, question_id, ...)
--     ON CONFLICT (field_id, question_id) WHERE deleted_at IS NULL DO UPDATE ...
--   That conflict target requires a PARTIAL UNIQUE INDEX on
--   (field_id, question_id) WHERE deleted_at IS NULL.
--   The index (uq_assessment_responses_field_question) was never created in the
--   database. Prisma cannot express partial unique indexes in schema.prisma, so
--   it must be created with raw SQL - this file.
--
-- HOW TO APPLY (pick one)
--   • psql:            \i prisma/sql/fix_assessment_responses_upsert_index.sql
--   • one-liner:       psql "$DATABASE_URL" -f prisma/sql/fix_assessment_responses_upsert_index.sql
--   • DB console (Neon/Supabase/etc.): paste + run the CREATE INDEX below.
-- ============================================================================

-- 1) SAFETY CHECK - run this FIRST. It must return ZERO rows.
--    (If it returns rows, there are already duplicate live answers that must be
--     de-duplicated before a unique index can be created - see step 1b.)
--
--    SELECT field_id, question_id, COUNT(*)
--    FROM   assessment_responses
--    WHERE  deleted_at IS NULL
--    GROUP  BY field_id, question_id
--    HAVING COUNT(*) > 1;

-- 1b) OPTIONAL de-dup (only if step 1 returned rows): keep the newest live answer
--     per (field_id, question_id), soft-delete the rest.
--
--    UPDATE assessment_responses r
--    SET    deleted_at = now()
--    WHERE  r.deleted_at IS NULL
--    AND    r.id NOT IN (
--             SELECT DISTINCT ON (field_id, question_id) id
--             FROM   assessment_responses
--             WHERE  deleted_at IS NULL
--             ORDER  BY field_id, question_id, updated_at DESC
--           );

-- 2) THE FIX - the partial unique index the upsert relies on.
CREATE UNIQUE INDEX IF NOT EXISTS uq_assessment_responses_field_question
  ON assessment_responses (field_id, question_id)
  WHERE deleted_at IS NULL;

-- After this runs, save-answer (PUT .../answer) works: first save INSERTs, later
-- saves hit the conflict and UPDATE the existing live answer.
