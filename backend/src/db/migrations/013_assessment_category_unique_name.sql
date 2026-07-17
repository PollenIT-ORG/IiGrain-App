-- Prevent duplicate live categories with the same name (case-insensitive).
-- Guards the Excel import's "create category if missing" path against a
-- check-then-create race, and enforces the invariant at the DB level.

-- First, soft-delete any pre-existing duplicates so the unique index can build.
-- Keep the oldest row per lowercased name; soft-delete the rest. Their questions
-- are reassigned to the surviving category so no questions are orphaned.
WITH ranked AS (
  SELECT id, LOWER(name) AS lname,
         ROW_NUMBER() OVER (
           PARTITION BY LOWER(name) ORDER BY created_at ASC, id ASC
         ) AS rn
    FROM assessment_categories
   WHERE deleted_at IS NULL
),
survivors AS (
  SELECT lname, id AS keep_id FROM ranked WHERE rn = 1
),
dupes AS (
  SELECT r.id AS dup_id, s.keep_id
    FROM ranked r
    JOIN survivors s ON s.lname = r.lname
   WHERE r.rn > 1
)
UPDATE assessment_questions q
   SET category_id = d.keep_id, updated_at = now()
  FROM dupes d
 WHERE q.category_id = d.dup_id
   AND q.deleted_at IS NULL;

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY LOWER(name) ORDER BY created_at ASC, id ASC
         ) AS rn
    FROM assessment_categories
   WHERE deleted_at IS NULL
)
UPDATE assessment_categories
   SET deleted_at = now()
 WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Partial unique index: only live rows are constrained, so a soft-deleted
-- category doesn't block re-creating one with the same name later.
CREATE UNIQUE INDEX IF NOT EXISTS uq_assessment_categories_name_alive
  ON assessment_categories (LOWER(name))
  WHERE deleted_at IS NULL;
