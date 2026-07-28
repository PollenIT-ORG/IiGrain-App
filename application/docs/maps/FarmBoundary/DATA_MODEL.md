# Farm Boundary — Data Model (Phase C intent)

The entity hierarchy, the boundary shape on the device and on the wire, and the
**backend contract** the server team implements for Phase E. No code — shapes and
rules only.

---

## 1. Entity hierarchy — where the boundary sits

```
Organization            (organizations)      — exists
   └── Farm             (farms)              — exists, has lat/lng
        └── Field       (fields)             — exists, has lat/lng ONLY
             └── Boundary        ◀── NEW. one polygon per field (Phase D)
                  └── Coordinates (the ring)
             └── Assessment      — exists, will later be geotagged INTO the boundary
             └── Soil / Weather / NDVI / Yield  — future, all CLIPPED TO the boundary
```

The boundary is a **property of a field**, one-to-one for now. It is the
**substrate** every future per-field layer is spatially clipped to — which is why
it is modelled as first-class data with its own version and derived geometry, not
as a loose array on the field row.

**Why one-to-one and not a separate table yet (Phase D):** a field has exactly
one boundary; local-only storage has no concurrency; a JSONB column on `fields`
is the least machinery that is correct. A separate versioned `field_boundaries`
table becomes worthwhile only when there is server sync + approval history —
designed for in ADR-B05, deferred until then.

---

## 2. On-device shape (Phase D — Redux + redux-persist)

What the app holds and persists locally. Field-relative, minimal, derivable-safe:

```
FieldBoundary {
  fieldId:        string
  farmId:         string
  orgId:          string | null      // carried for future org-scoped features
  ring:           LatLng[]           // CLOSED ring (first point repeated at end)
  areaSqM:        number             // computed once, stored (never re-derived on read)
  center:         LatLng             // centroid — map framing / pin fallback
  bbox:           { minLat; minLng; maxLat; maxLng }
  version:        number             // bumped on every save; base for future sync
  syncStatus:     'local'            // Phase D: always 'local'. Phase E adds 'synced' | 'pending' | 'conflict'
  updatedAt:      string             // ISO, device clock (informational only)
}
```

- Lives in a dedicated `boundary` Redux slice, keyed by `fieldId`, persisted via
  the existing `redux-persist` setup.
- `syncStatus` exists **from day one** even though it is always `'local'` now —
  so Phase E adds a sync layer without a data migration.
- `version` is a plain integer, bumped locally. It becomes the optimistic-concurrency
  token when the API arrives.

---

## 3. Serialised (GeoJSON) shape — the wire + JSONB format

The polygon is stored and transmitted as a **GeoJSON `Polygon`** — the universal
standard, so GeoJSON export/import (Phase E) is nearly free, and any GIS tool or
future PostGIS column ingests it directly.

```jsonc
// value of fields.boundary (JSONB)
{
  "type": "Polygon",
  // array of linear rings; ring[0] is the outer boundary.
  // Phase D uses exactly one ring. Holes = ring[1..] (Phase E).
  "coordinates": [
    [ [lng, lat], [lng, lat], [lng, lat], [lng, lat] ]  // NOTE: [lng, lat] order, closed
  ]
}
```

**Two traps, both handled at the repository boundary so the engine never sees
them** (see [DRAWING_ENGINE.md §9](./DRAWING_ENGINE.md#9-coordinate--storage-model-summary)):

1. **Order is `[longitude, latitude]`** in GeoJSON — the reverse of our `LatLng`.
   The single most common GeoJSON bug. Converted in one mapper, both directions.
2. **The ring is closed** in GeoJSON (first coordinate repeated as last); our
   engine keeps it open. Close-on-serialise, open-on-parse, once.

---

## 4. Backend contract (Phase E — hand this to the backend team)

This is the whole backend task, specified so it needs no re-derivation. Modelled
exactly on the existing lat/lng migration (`022_add_geo_coordinates.sql`) and the
existing `field.service` / `field.schema` patterns.

### 4.1 Migration (`0NN_add_field_boundary.sql`)
```sql
ALTER TABLE fields ADD COLUMN IF NOT EXISTS boundary        JSONB;
ALTER TABLE fields ADD COLUMN IF NOT EXISTS area_sqm        DOUBLE PRECISION;
ALTER TABLE fields ADD COLUMN IF NOT EXISTS boundary_center_lat  DECIMAL(9,6);
ALTER TABLE fields ADD COLUMN IF NOT EXISTS boundary_center_lng  DECIMAL(9,6);
ALTER TABLE fields ADD COLUMN IF NOT EXISTS boundary_version     INTEGER NOT NULL DEFAULT 0;
-- bbox as four columns (cheap "near X" filtering before any PostGIS):
ALTER TABLE fields ADD COLUMN IF NOT EXISTS bbox_min_lat DECIMAL(9,6);
ALTER TABLE fields ADD COLUMN IF NOT EXISTS bbox_min_lng DECIMAL(9,6);
ALTER TABLE fields ADD COLUMN IF NOT EXISTS bbox_max_lat DECIMAL(9,6);
ALTER TABLE fields ADD COLUMN IF NOT EXISTS bbox_max_lng DECIMAL(9,6);
```
Nullable — a field without a drawn boundary is valid (mirrors nullable lat/lng).

### 4.2 Endpoints (extend the existing field routes — no new controller)
```
PATCH /farms/:farmId/fields/:fieldId/boundary
  body:  { boundary: GeoJSONPolygon, areaSqM: number, version: number }
  200:   the updated field, boundary included
  409:   version conflict (someone saved a newer boundary) — Phase E concern
  422:   invalid geometry (server re-validates; see 4.4)

DELETE /farms/:farmId/fields/:fieldId/boundary
  200:   boundary cleared

GET  /farms/:farmId/fields/:fieldId       // existing — just starts returning `boundary`
```

Alternatively fold `boundary` / `areaSqM` into the existing `PATCH …/fields/:id`
body — either is fine; a dedicated sub-route keeps boundary writes auditable.

### 4.3 Validation (Zod, mirroring `field.schema.ts`)
- `boundary.type === 'Polygon'`.
- `coordinates[0].length >= 4` (3 distinct + closing point).
- Every coord in range (lat −90..90, lng −180..180) — the existing
  `latitudeField`/`longitudeField` validators apply per point.
- Ring is closed (first == last); server closes it if the client didn't.
- `areaSqM > 0`.
- **Server does not trust client area** for anything critical — it may recompute
  server-side later; for now it stores what the client computed but validates the
  polygon itself.

### 4.4 Server-side geometry validation (defensive)
Min-vertex and self-intersection re-checked server-side — a client is never the
sole guardian of data integrity. Reject with 422 + which edges cross.

### 4.5 Sync / cache-tag wiring (already has a home)
The socket + cache-tag system (`redux/syncTags.ts`) already invalidates on a
`field` resource change. A boundary write emits the same `field` sync event, so
`Tags.field(fieldId)` / `Tags.fields(farmId)` invalidations already cover it — **no
new tag needed**. This is why Phase-E sync is additive.

---

## 5. Designed-for-but-not-built (so today's shape doesn't block tomorrow)

| Future need | How the shape already accommodates it |
|---|---|
| **Holes / exclusions** (a pond inside a field) | GeoJSON `coordinates[1..]` are holes. Column is already `Polygon`, ready. |
| **Multiple fields / MultiPolygon** | Store type widens to `MultiPolygon`; repository mapper is the only change. |
| **GPS-walk recording** | Produces the same `LatLng[]` ring → same engine, same storage. UX differs, data identical. |
| **GeoJSON / KML / Shapefile I/O** | Storage *is* GeoJSON; export is a passthrough, KML/Shapefile are converters over the same ring. |
| **PostGIS upgrade** | JSONB → `geometry(Polygon,4326)` is a backfill migration; the API shape (GeoJSON in/out) is unchanged, so the app doesn't move. |
| **Versioned history / approval workflow** | `version` exists now; promote to a `field_boundaries` history table when sync lands (ADR-B05). `syncStatus` gains `'pending'`/`'conflict'`. |
| **Assessment geotagging** | Assessment coords test point-in-polygon against `boundary` (app-side now, PostGIS `ST_Contains` later). |
| **NDVI / weather / yield layers** | All clip to `boundary`; `bbox` columns give a cheap pre-filter before any spatial index exists. |

---

## 6. Data-integrity rules (invariants)

1. A stored boundary's `ring` is always a valid closed GeoJSON ring (≥ 4 points,
   first == last, no self-intersection).
2. `areaSqM`, `center`, `bbox` are **always derived from `ring`** by the one
   `geo.ts` function set — never entered or edited independently.
3. `version` strictly increases per field.
4. Deleting a field cascades its boundary (it's a column / it's keyed by fieldId).
5. The typed `field.areaAcres` and the drawn `areaSqM` are **independent values**;
   neither silently overwrites the other (open question Q1).
