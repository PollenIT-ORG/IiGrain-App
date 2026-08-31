-- Field monitoring no longer belongs to a program. Records hang off the field.

DO $$
DECLARE
  t   TEXT;
  fk  TEXT;
  tables TEXT[] := ARRAY[
    'field_trainings', 'field_soil_samples', 'field_irrigations', 'field_pesticides',
    'field_fertilizers', 'field_tillage_records', 'field_amendments', 'field_crop_records',
    'field_nutrient_events', 'field_module_documents'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass(t) IS NULL THEN
      CONTINUE;
    END IF;

    -- Drop every foreign key on this table that points at programs.
    FOR fk IN
      SELECT c.conname
        FROM pg_constraint c
        JOIN pg_class rel ON rel.oid = c.conrelid
        JOIN pg_class ref ON ref.oid = c.confrelid
       WHERE c.contype = 'f' AND rel.relname = t AND ref.relname = 'programs'
    LOOP
      EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', t, fk);
    END LOOP;

    EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS program_id', t);
  END LOOP;
END $$;

-- The old indexes were on (field_id, program_id); replace them with field only.
DROP INDEX IF EXISTS idx_field_trainings_fp;
DROP INDEX IF EXISTS idx_field_soil_samples_fp;
DROP INDEX IF EXISTS idx_field_irrigations_fp;
DROP INDEX IF EXISTS idx_field_pesticides_fp;
DROP INDEX IF EXISTS idx_field_fertilizers_fp;
DROP INDEX IF EXISTS idx_field_tillage_fp;
DROP INDEX IF EXISTS idx_field_amendments_fp;
DROP INDEX IF EXISTS idx_field_crop_records_fp;
DROP INDEX IF EXISTS idx_field_nutrient_events_fp;
DROP INDEX IF EXISTS idx_field_module_documents_fp;

CREATE INDEX IF NOT EXISTS idx_field_trainings_field        ON field_trainings (field_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_field_soil_samples_field     ON field_soil_samples (field_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_field_irrigations_field      ON field_irrigations (field_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_field_pesticides_field       ON field_pesticides (field_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_field_fertilizers_field      ON field_fertilizers (field_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_field_tillage_field          ON field_tillage_records (field_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_field_amendments_field       ON field_amendments (field_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_field_crop_records_field     ON field_crop_records (field_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_field_nutrient_events_field  ON field_nutrient_events (field_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_field_module_documents_field ON field_module_documents (field_id, module) WHERE deleted_at IS NULL;
