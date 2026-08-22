-- Field boundary polygons. Additive and reversible: two nullable columns with
-- no default and no backfill, so existing rows read as NULL ("no boundary drawn
-- yet"). Nothing existing is modified. The migration runner already wraps this
-- file in a transaction, so no explicit BEGIN/COMMIT here.

ALTER TABLE fields
  ADD COLUMN IF NOT EXISTS boundary JSONB;

ALTER TABLE fields
  ADD COLUMN IF NOT EXISTS boundary_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN fields.boundary IS
  'Surveyed field outline as a GeoJSON Polygon with a closed outer ring. NULL until drawn.';
COMMENT ON COLUMN fields.boundary_updated_at IS
  'When the boundary was last written. Used for last-write-wins conflict resolution.';

-- Most rows are NULL, and every query that touches this column is "does this
-- field have a boundary", so a partial index is enough.
CREATE INDEX IF NOT EXISTS idx_fields_has_boundary
  ON fields (id)
  WHERE boundary IS NOT NULL;
