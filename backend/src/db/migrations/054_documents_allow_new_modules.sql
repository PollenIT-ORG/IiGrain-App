-- Attachments can hang off the two modules added in 053, which the original
-- check constraint did not know about.
-- Adding a module means adding it here too, or its uploads fail with 23514.

ALTER TABLE field_module_documents
  DROP CONSTRAINT IF EXISTS ck_field_module_documents_module;

ALTER TABLE field_module_documents
  ADD CONSTRAINT ck_field_module_documents_module
  CHECK (module IN (
    'training', 'soil_samples', 'irrigation', 'pesticide', 'fertilizer',
    'tillage', 'amendment', 'crop', 'nutrient',
    'crop_intensification', 'animal_integration',
    'other'
  ));
