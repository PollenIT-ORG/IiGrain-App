-- 028_drop_field_status.sql
-- The field health status (healthy / monitor / critical) is not needed by the
-- client. Drop it (any index on the column is dropped automatically).
ALTER TABLE fields DROP COLUMN IF EXISTS status;
