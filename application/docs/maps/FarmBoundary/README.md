# Farm Boundary Module — Product & Planning Document

**Status:** ✅ Phase D implemented (local storage) · **Owner:** Mobile GIS
**Last updated:** 2026-07-24

> Phase A (planning) and **Phase D (draw · edit · area · local save/load)** are
> done. Boundaries persist **on-device** (Redux + redux-persist); the server
> contract in [DATA_MODEL §4](./DATA_MODEL.md) is the remaining Phase-E work.
> The design docs below stay the source of truth — read them before changing the
> module. What shipped is summarised in
> [docs/maps/CHANGELOG.md](../CHANGELOG.md) `[1.3.0]`.

| Document | What it covers |
|---|---|
| [README.md](./README.md) | PRD, the storage blocker, decisions, roadmap, risks, open questions |
| [UX.md](./UX.md) | The drawing experience: flow, screen states, toolbar, every interaction |
| [DRAWING_ENGINE.md](./DRAWING_ENGINE.md) | Vertices, editing, undo/redo, validation, area — the engine design |
| [DATA_MODEL.md](./DATA_MODEL.md) | Entity hierarchy, the boundary shape, the backend contract (for later) |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Folder layout, components, hooks, services, Redux, what to reuse |
| [DECISION_LOG.md](./DECISION_LOG.md) | ADR-B01…B0N — every choice, its alternatives and trade-offs |

---

## 0. The one thing you must know first

**The backend cannot store a boundary today.** Verified against
`backend/prisma/schema.prisma`, migrations `001`–`029`, `field.service.ts`,
`field.schema.ts` and every `hoppscotch/` spec:

- `fields` has `latitude` / `longitude` only — `Decimal(9,6)`, a single point.
- No JSON column, no PostGIS geometry, no boundary table, no boundary field in
  the mobile `CreateFieldInput` / `UpdateFieldInput`.
- "boundary" appears in the backend only as a sample `location: "South boundary"`
  **string** — not geometry.

This is the module's foundation, and its storage does not exist. Two consequences
drive every decision below:

1. The **drawing engine, editing and area calculation can be built now**,
   entirely on the device.
2. **Persistence is staged.** Per the approved decisions:
   - **Now (Phase D):** the boundary is stored **locally** — Redux +
     `redux-persist` — with a `syncStatus` field that is always `'local'`. The
     feature is fully usable; it just doesn't leave the device yet.
   - **Later:** a backend `JSONB boundary` column on `fields` (+ `area_sqm`,
     `center_lat/lng`, `bbox`, `polygon_version`) makes it permanent. The exact
     migration and endpoint shape is specified in [DATA_MODEL.md](./DATA_MODEL.md)
     so the backend team can implement it without re-deriving anything.

The engine is written against a **repository interface**, not against the API.
Swapping local storage for the API is one file — see
[ARCHITECTURE.md](./ARCHITECTURE.md#5-the-repository-seam).

---

## 1. Approved decisions (locked for this plan)

| # | Decision | Consequence |
|---|---|---|
| D1 | **Storage shape:** GeoJSON-style polygon in a `JSONB boundary` column on `fields`, plus derived `area_sqm`, center, bbox, `polygon_version`. | No DB spatial queries yet; area is computed on the device. PostGIS is a future upgrade (ADR-B02). |
| D2 | **Persistence now:** local-only (Redux + redux-persist), `syncStatus: 'local'`. Backend comes later against the documented contract. | The module ships and is testable without any backend work. A sync layer is added in Phase E. |
| D3 | **First implementation (Phase D):** draw + edit + area + save/load. | GPS-walk, GeoJSON/KML, offline tiles, multi-polygon, holes → Phase E. |
| D4 | **Entry point:** a new full-screen `BoundaryEditor` route, opened from **FieldDetails**. | A field already exists (so farm/field/org context is known); the editor is satellite-first and owns the whole screen. |

---

## 2. PRD — Product Requirement Document

### 2.1 Problem

A field is currently a single dropped pin plus a typed acreage. That is enough to
say *roughly where* a field is, and nothing about its **shape or true extent**.
Every future precision-agriculture feature — assessment geotagging, NDVI, weather
per-field, irrigation zones, yield maps, drone overlays — needs the field's
**actual polygon**, not a point. This module lets a farmer draw that polygon on
satellite imagery, the way Google Earth does.

### 2.2 Users & the core scenario

- **Primary user:** the farmer, on their own phone, standing at or near the field
  (or at home from memory), on a mid-range Android device, on rural connectivity.
- **Secondary user (future):** the assessor, verifying or correcting a boundary.

**Core scenario.** Farmer opens a field → taps *Draw boundary* → the map is
already in **satellite**, centred on the field's pin → they zoom until the field
fills the screen → they tap each corner → the polygon closes and fills → they nudge
a corner that was off → the area updates live in acres → they save. The field now
has a shape.

### 2.3 Goals

- Draw an accurate field polygon on satellite imagery with tap-to-add vertices.
- Edit freely: drag a vertex, insert one on an edge, delete one, undo/redo.
- See **area live** in acres / hectares / m² / ft².
- Prevent invalid geometry (too few points, self-intersection, zero area).
- Persist the boundary and reload it for viewing and re-editing.
- Be built as a **reusable GIS module** that the roadmap features extend without
  a rewrite.

### 2.4 Non-goals (this phase)

Multi-polygon per field, holes/exclusions, GPS-walk recording, GeoJSON/KML/
Shapefile import-export, offline tiles, drone/NDVI overlays, boundary approval
workflow, server sync. All are designed *for* in [DATA_MODEL.md](./DATA_MODEL.md)
and [DECISION_LOG.md](./DECISION_LOG.md) so they don't require re-architecting —
but none is built in Phase D.

### 2.5 Success criteria

- A farmer can draw a 4–8 vertex field in under a minute without instruction.
- Area matches a hand-measured reference within ~2%.
- Drag stays smooth (no dropped frames) up to ~200 vertices on a mid-range
  Android device.
- Re-opening a saved field shows the exact polygon that was saved, editable.

---

## 3. What we learned from the incumbents (Phase 2, condensed)

| Product | The one idea worth stealing |
|---|---|
| **Google Earth / Maps drawing** | Tap-to-add on satellite; the *fixed centre-crosshair* option for precision when a fingertip would cover the target. We already own this pattern in `LocationPicker` (`MapCenterPin`). |
| **ArcGIS Field Maps** | A clear **mode** separation — you are either *navigating* or *drawing*, never ambiguously both — plus GPS "streaming" (walk the perimeter). Modes inform our toolbar. |
| **John Deere Operations Center** | Boundaries are **versioned, named entities** with area front-and-centre. Drives our `polygon_version` + area-always-visible decisions. |
| **Climate FieldView** | *Draw once, reuse everywhere* — the boundary is the substrate every later layer is clipped to. This is exactly our "foundation" framing. |
| **Trimble Ag / DJI Ag** | Vertex **handles are large and offset** so the finger never hides the point; a live edge-length/area readout. Drives handle sizing in [UX.md](./UX.md). |

Common thread: **modes, big offset handles, area always visible, boundary as a
first-class reusable object.** All four are reflected in this plan.

---

## 4. Development roadmap

Maps onto the user's Phase A–E framing.

| Phase | Deliverable | Notes |
|---|---|---|
| **A — Planning** | *This folder.* PRD, UX, engine design, data model, ADRs. | ← we are here |
| **B — Design** | Wireframes + screen-state catalogue + toolbar spec in [UX.md](./UX.md). | No code; annotated states. |
| **C — Architecture** | Folder skeleton, component/hook/service contracts, Redux slice shape, coordinate-engine API — [ARCHITECTURE.md](./ARCHITECTURE.md). | Interfaces only; still no engine code. |
| **D — Implementation** | Draw · edit · area · **local** save/load. The shippable feature. | Repository = local. `syncStatus:'local'`. |
| **E — Advanced** | GPS-walk · **backend sync** · GeoJSON/KML · multi-field · offline · overlays. | Each is additive; see DATA_MODEL contract + ADRs. |

**Phase D is deliberately sized to be one coherent, testable feature** — not an
MVP that has to be re-opened to add editing, and not a mega-phase that drags in
GPS streaming.

---

## 5. Risk analysis

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Backend boundary storage never gets prioritised | Medium | High | Local-only Phase D means the feature ships regardless; the [DATA_MODEL contract](./DATA_MODEL.md) makes the backend task small and unambiguous. |
| Dragging a large polygon janks on Android | Medium | High | Custom vertex markers `tracksViewChanges={false}`; drag updates one vertex, not the whole array; edge-midpoint "insert" handles rendered only when zoomed in. See [DRAWING_ENGINE.md §7](./DRAWING_ENGINE.md#7-performance). |
| Self-intersecting polygons corrupt area / later spatial ops | Medium | Medium | Segment-intersection check on every commit; block save, highlight the offending edges. |
| Farmer fat-fingers a vertex, no way back | High | Medium | Undo/redo stack (≥20 steps); long-press-to-delete with a confirmation only when it would drop below 3 vertices. |
| Satellite tiles fail to load (rural connectivity) | High | Medium | Draw still works over the last cached tiles / grey; area is geometry, not imagery; explicit "imagery unavailable" banner, never a blocking error. |
| Area shown ≠ area stored (precision drift) | Low | Medium | One `computeArea` function, used for both display and persistence; store the computed `area_sqm` alongside the polygon. |
| Two devices edit the same field (future sync) | Low (now) | High (later) | `polygon_version` + `syncStatus` designed in now; conflict strategy deferred to the sync ADR, but the fields exist from day one. |

---

## 6. Edge cases (catalogue — full handling in DRAWING_ENGINE §6)

Geometry: < 3 vertices · duplicate/coincident taps · self-intersection ·
near-zero area · a vertex dragged onto another · all vertices collinear ·
1000+ vertices · antimeridian crossing (out of scope for Indian farmland, noted).
Environment: imagery offline · GPS unavailable for "centre on me" · app
backgrounded mid-draw · rotation mid-draw · low memory.
User: taps *back* with unsaved edits · saves an unchanged polygon · edits a
boundary that a future assessment already references.

---

## 7. Questions that must be answered before Phase D

1. **Acreage reconciliation.** A field already has a typed `areaAcres`. When the
   drawn area differs, do we (a) overwrite it, (b) keep both and show the delta,
   or (c) leave typed acreage untouched and treat drawn area as separate? *Plan's
   assumption: (b) — show both, never silently overwrite user input.*
2. **Who may edit a boundary?** Owner only, or assessor too? Affects the future
   audit/version design, not Phase D UI. *Assumption: owner only for now.*
3. **Backend timeline.** Is the JSONB migration something the backend team can
   commit to for Phase E, or should the sync layer be designed to tolerate a long
   local-only period? *Assumption: design sync as additive, no deadline coupling.*
4. **Acreage unit default.** Acres for display (Indian farmland convention), with
   ha/m²/ft² toggle? *Assumption: yes, acres default.*
5. **Minimum viable vertex count / max.** Confirm 3 min; is there a product max
   (e.g. warn beyond 500)? *Assumption: 3 min, soft-warn at 500.*

These are listed so they are answered deliberately, not discovered mid-build.

---

## 8. Production-readiness checklist (to satisfy before Phase D ships)

- [ ] Draw / edit / undo / redo / delete all work on both platforms
- [ ] Area within ~2% of a surveyed reference on 3 real fields
- [ ] Self-intersection blocked with a clear message
- [ ] Smooth drag at 200 vertices on a mid-range Android device
- [ ] Boundary survives app restart (redux-persist)
- [ ] Re-open → exact polygon, editable
- [ ] Imagery-offline path shows a banner, never blocks drawing
- [ ] Back-with-unsaved-edits prompts to discard/keep
- [ ] `docs/maps/FarmBoundary/` completed from the real code, CHANGELOG started
