-- 027_farm_business_entity.sql
-- Optional free-text business name for a farm (the farmer's business entity, if
-- they have one). Purely informational.
ALTER TABLE farms ADD COLUMN IF NOT EXISTS business_entity VARCHAR(200);
