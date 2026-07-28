# Farm Boundary — Decision Log (ADRs)

Every significant boundary-module decision: **Decision · Context · Alternatives ·
Trade-offs · Future impact**. Same format as `docs/maps/DECISION_LOG.md`.

These are **planning-phase** ADRs — proposed, to be confirmed at Phase-D kickoff.
Reversing any is fine; do it knowing the original constraint.

---

## ADR-B01 — Ship boundary storage locally first, backend later

**Status:** Proposed · 2026-07-24

**Decision.** Phase D persists the boundary on-device only (Redux +
redux-persist, `syncStatus: 'local'`). Server persistence is Phase E, against a
documented contract.

**Context.** The backend has **no** boundary storage today — `fields` holds a
single lat/lng, no JSON, no PostGIS (verified across schema, migrations,
services, specs). The mobile repo is the unit of work here; backend is a separate
team/deploy.

**Alternatives.**
- *Block the whole module until the backend column ships* — couples a large
  frontend effort to another team's schedule for no engine-level reason.
- *Build backend too, now* — possible (the `backend/` folder is in the
  workspace) but takes on migration/deploy ownership the user scoped out.

**Trade-offs.**
- ✅ The feature ships and is fully testable with zero backend work. ✅ The
  engine, UX and validation — the hard parts — are proven before any wire format
  is committed. ✅ The [DATA_MODEL contract](./DATA_MODEL.md#4-backend-contract-phase-e--hand-this-to-the-backend-team)
  makes the eventual backend task small and unambiguous.
- ❌ "Permanent storage" is not literally true until Phase E — a boundary lives
  only on the device that drew it. ❌ No cross-device / web visibility yet.

**Future impact.** The repository seam (ADR-B04) makes the switch one binding.
`syncStatus` and `version` exist from day one, so no data migration is needed to
turn on sync.

---

## ADR-B02 — Store GeoJSON in JSONB, not PostGIS (yet)

**Status:** Proposed · 2026-07-24

**Decision.** The eventual column is `fields.boundary JSONB`, holding a GeoJSON
`Polygon`, plus derived `area_sqm` / center / bbox / `boundary_version` columns.

**Context.** The choice is JSONB vs enabling PostGIS `geometry(Polygon,4326)`.

**Alternatives.**
- *PostGIS* — true spatial DB: `ST_Area`, `ST_Contains`, `ST_Intersects`,
  GIST indexes. The "correct" long-term GIS substrate.
- *Separate versioned table* — see ADR-B05.

**Trade-offs.**
- ✅ JSONB needs no Postgres extension, no ops change, one nullable-column
  migration modelled on the existing `022_add_geo_coordinates.sql`. ✅ GeoJSON is
  the universal format → export/import is nearly free. ✅ `bbox` columns give
  cheap "near X" filtering without a spatial index.
- ❌ No database-side spatial queries — area is computed on the device;
  point-in-polygon (assessment geotagging) is app-side for now. ❌ A future
  PostGIS move is a backfill migration.

**Future impact.** GeoJSON-in / GeoJSON-out means the **API shape does not change**
when PostGIS is adopted — `JSONB` → `geometry` is a server backfill; the app
never moves. This is why JSONB-first is not a dead end.

---

## ADR-B03 — Phase D scope: draw + edit + area + save/load

**Status:** Proposed · 2026-07-24

**Decision.** The first shippable feature includes tap-draw, full editing
(drag/insert/delete), undo/redo, live multi-unit area, geometry validation, and
local save/load. GPS-walk, import/export, offline, multi-polygon, holes are
Phase E.

**Context.** The user chose the "complete usable feature" slice over a
draw-only MVP and over a mega-phase including GPS streaming.

**Alternatives.**
- *Draw + area only (MVP)* — smaller, but "editable polygon" is a core
  requirement, and shipping without editing means immediately re-opening the
  screen to add it.
- *Full engine incl. GPS-walk* — largest single phase, most test surface, riskier.

**Trade-offs.**
- ✅ One coherent feature a farmer can actually use, verifiable end-to-end. ✅
  Editing designed in from the start, so no re-architecture to add it.
- ❌ Bigger than an MVP — more to build before the first ship.

**Future impact.** GPS-walk reuses the exact same engine (feeds `addVertex` from
`watchPosition`), so deferring it costs nothing architecturally.

---

## ADR-B04 — Engine is a pure reducer behind a repository interface

**Status:** Proposed · 2026-07-24

**Decision.** All geometry/edit/undo logic is a pure `(draft, action) → draft`
reducer plus pure `geo.ts` functions. Persistence is behind a
`BoundaryRepository` interface with a local impl now, an API impl later.

**Context.** This is the enterprise-grade / testable / swappable requirement made
concrete.

**Alternatives.**
- *Logic inside the screen component* — fast to write, impossible to unit-test,
  and it welds drawing to `react-native-maps` and to Redux.
- *A third-party polygon-editing library* — none fits `react-native-maps` +
  New Architecture well; a dependency in this hot path is a liability.

**Trade-offs.**
- ✅ The hard parts (area accuracy, self-intersection, undo) are unit-testable
  with zero mocks. ✅ Storage swaps in one binding. ✅ The same engine powers
  GPS-walk and import. ✅ Consistent with the maps module's pure-`utils` charter.
- ❌ More indirection than inlining everything in the screen. ❌ The reducer +
  repository interface are upfront design work before pixels move.

**Future impact.** Every Phase-E feature (GPS, import, sync) plugs into an
existing seam rather than reworking the core.

---

## ADR-B05 — One boundary per field on the field row now; versioned table later

**Status:** Proposed · 2026-07-24

**Decision.** Phase D/E model a single boundary per field, stored on the field
(JSONB column). A separate `field_boundaries` history table is deferred until
server sync + an approval/audit workflow exists.

**Context.** A field has one current boundary. History, approval and conflict
resolution only have meaning once multiple actors + multiple devices write to the
server.

**Alternatives.**
- *A versioned `field_boundaries` table from day one* — supports audit/rollback
  immediately, but is the most backend work and is unused while storage is local
  and single-writer.

**Trade-offs.**
- ✅ Least machinery that is correct for the current reality. ✅ `boundary_version`
  exists now, so promoting to a history table is additive, not a rewrite.
- ❌ No boundary history / rollback until that table lands. ❌ Approval workflow
  (assessor signs off a farmer's boundary) waits for it.

**Future impact.** When sync arrives: add the history table, move `version` into
it, extend `syncStatus` with `'pending'`/`'conflict'`. The app's
repository interface absorbs it; screens don't change.

---

## ADR-B06 — Boundary is a sub-feature of `src/maps/`, not a new module

**Status:** Proposed · 2026-07-24

**Decision.** Boundary code lives under `src/maps/boundary/` and reuses the maps
module's map surface, camera, crosshair, geo utils and primitives seam.

**Context.** Boundary drawing *is* map functionality.

**Alternatives.**
- *A top-level `src/boundary/` feature module* — would duplicate `AppMapView`
  usage patterns, re-open the one-import rule, and split map knowledge across two
  folders.

**Trade-offs.**
- ✅ Reuses `AppMapView`, `useMapCamera`, `MapCenterPin`, `geo.ts`,
  `MapPrimitives`. ✅ One place owns "the vendor map". ✅ Additions to `geo.ts`
  and `MapPrimitives.ts` benefit the whole module.
- ❌ `src/maps/` grows a larger sub-tree — acceptable; it is still one cohesive
  map module.

**Future impact.** NDVI, weather and drone overlays are *also* map sub-features
and follow the same pattern, all sharing the boundary as their clip substrate.

---

## ADR-B07 — Entry from FieldDetails as a full-screen route

**Status:** Proposed · 2026-07-24

**Decision.** A dedicated `BoundaryEditor` route, opened from FieldDetails, not an
inline panel and not part of the AddField form.

**Context.** Drawing needs the whole screen (satellite, thumb-reachable toolbar,
uninterrupted map gestures) and full field/farm/org context.

**Alternatives.**
- *Inside the AddField flow* — AddField is already a long form; embedding a
  full-screen editor compromises both.
- *Inline on FieldDetails* — too little room for a precision drawing surface.

**Trade-offs.**
- ✅ Editor owns the screen; the field already exists so all context is known;
  satellite-first with no form noise. ✅ Clean back-to-FieldDetails on save.
- ❌ One more route + navigation param. Trivial.

**Future impact.** A second entry point (from the `FieldMap`/`MapExplorer` field
marker) is a pure addition later — same route, same params.

---

## ADR-B08 — Never silently overwrite the farmer's typed acreage

**Status:** Proposed · 2026-07-24 · **depends on open question Q1**

**Decision.** The drawn `areaSqM` and the typed `field.areaAcres` are independent.
When they differ, show both; do not overwrite the typed value.

**Context.** Fields already carry a hand-typed acreage. A drawn area is often more
accurate, but silently replacing a user's own input is hostile and erodes trust.

**Trade-offs.**
- ✅ The farmer stays in control; discrepancies are surfaced, not hidden.
- ❌ Two area numbers can coexist and confuse — mitigated by clear labelling
  ("Typed" vs "Drawn") and showing the delta.

**Future impact.** If product later decides drawn area is authoritative, it
becomes a one-line policy change with the data already in place. Confirm Q1 at
kickoff.

---

## Template

```markdown
## ADR-B0N — Title
**Status:** Proposed | Accepted | Superseded by ADR-B0M · DATE
**Decision.** One sentence.
**Context.** What forces the choice.
**Alternatives.** What else, why it loses.
**Trade-offs.** ✅ gains / ❌ costs.
**Future impact.** What it makes easy / expensive.
```
