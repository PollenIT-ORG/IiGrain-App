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

## ADR-B09 — Draw the handles as a screen-space overlay on iOS, not as map markers

**Status:** Accepted · 2026-08-22

**Decision.** The vertex and midpoint handles are rendered by
`BoundaryHandleLayer`, a plain React Native overlay positioned above the map, on
iOS. Android keeps the `<Marker>`-based `VertexMarker` / `MidpointHandle`. The
choice is one constant, `USE_OVERLAY_HANDLES`.

**Context.** [UX §9](./UX.md#9-what-we-reuse-so-this-isnt-built-from-scratch) and
[DRAWING_ENGINE §7](./DRAWING_ENGINE.md#7-performance) both assume the handles are
custom marker views with a `tracksViewChanges` latch. That assumption does not
hold on iOS: with the New Architecture and `PROVIDER_GOOGLE`, react-native-maps
1.29 never lays out the marker's icon container, so a marker with children is
zero-sized — invisible and un-hittable. The editor was therefore unusable on
iOS while being correct on Android. There is no JS-level workaround: `style`,
`flat`, and a permanently-true `tracksViewChanges` were all tested and all fail.

**Alternatives.**
- *Patch the pod* (`patch-package` over `AIRGoogleMapMarker`). Fixes every
  custom marker in the app at once, and is the true root-cause fix — but adds a
  patch to maintain across upgrades, forces a native rebuild on every machine
  and in CI, and the sizing hook has to guess when Fabric has laid the children
  out. Worth revisiting as a follow-up; too much surface for this fix.
- *Switch iOS to Apple MapKit*, where marker children render correctly. One line,
  but it silently drops Google tiles and the custom style on one platform —
  exactly the divergence [TROUBLESHOOTING #10](../TROUBLESHOOTING.md#10-ios-renders-apple-maps-instead-of-google)
  calls the most dangerous failure in the integration.
- *Use the overlay on both platforms.* Preferable — one path, no divergence —
  and the component is written for it. Not done here only because Android could
  not be tested from this machine, and Android currently works.

**Trade-offs.**
- ✅ iOS works, with no native change and no new dependency. ✅ Hit areas, halos
  and numbering are ours, not the SDK's. ✅ Drag no longer depends on the SDK's
  marker-drag semantics. ✅ Identical behaviour is available on Android by
  flipping one constant.
- ❌ Two rendering paths for the same handles until the flag is unified.
- ❌ The handles are positioned from `onRegionChange`, so during a fast pan they
  trail the tiles by a frame or two; the native `<Polygon>` does not. They snap
  back the moment the camera settles.
- ❌ The linear region→screen projection is an approximation of Mercator. At the
  editor's working zoom the error is well under a centimetre (test 3), but it
  would grow if the editor were ever used zoomed far out.

**Future impact.** The engine, validation and persistence are untouched — this is
purely how handles are drawn and how a gesture becomes a coordinate. If the pod
is ever patched, deleting `USE_OVERLAY_HANDLES` and the overlay restores the
original design with no other change.

---

## ADR-B10 — Pad the iOS polygon ring so its coordinate count always changes

**Status:** Accepted · 2026-08-24

**Decision.** `BoundaryPolygon` appends one or two repeats of the ring's last
vertex before handing coordinates to the native polygon on iOS, choosing the
number so the length is never the length sent on the previous render.

**Context.** react-native-maps 1.29's Fabric polygon for Google-on-iOS rebuilds
its `GMSMutablePath` only when the coordinate *count* changes. Moving a vertex
changes values, not count, so the shape froze during editing while the handles
moved — the visible half of the "editing does nothing" report. Drawing was
unaffected because every tap appends a point.

**Alternatives.**
- *Draw the outline and fill in the SVG overlay* alongside the handles
  ([`BoundaryVectorOverlay`](../../../src/maps/boundary/components/BoundaryVectorOverlay.tsx)
  already does this). No hack, and shape and handles would be guaranteed in
  sync — but the shape would then be positioned from `onRegionChange` like the
  handles, so it would trail the satellite tiles during a pan. The native
  polygon is GPU-drawn and pixel-locked to the imagery; giving that up for a
  redraw bug is the wrong trade.
- *Remount the polygon on every change* (`key={counter}`). Also forces a fresh
  path, but tears down and rebuilds a `GMSPolygon` per frame — far more
  expensive than one extra coordinate, and it flickers.
- *Patch the pod.* The true fix, and a two-line one (compare the coordinates,
  not just the size). Same objection as ADR-B09: a patch to carry across
  upgrades and a native rebuild everywhere. Worth doing together with the marker
  patch if we ever take that on.

**Trade-offs.**
- ✅ Two lines of effect, no native change, no rebuild, no new dependency.
  ✅ Keeps the native polygon and its exact registration with the tiles.
  ✅ Fixes every boundary surface at once, since they all draw through this one
  component.
- ❌ It is a workaround for someone else's bug, and it looks strange without the
  comment that explains it — hence the comment, the tests, and this ADR.
- ❌ One redundant coordinate in the native path (a zero-length segment). No
  visual or measurement effect: area, perimeter and validation are computed in
  JS from the real ring, never from the native polygon.

**Future impact.** Confined to `BoundaryPolygon`. When the SDK compares
coordinates properly, delete `usePathNudge` and pass `ring` through; the tests
in `__tests__/boundaryPolygon.test.tsx` are the only other thing to remove.

---

## ADR-B11 — First-draw coach mark: a live demo, blocking, once per device

**Status:** Accepted · 2026-08-24

**Decision.** The first time a device opens DRAW mode, a full-screen coach mark
plays a looping demo of the tap-tap-tap gesture — using the real dot/line
styling and the real `BOUNDARY_HINTS` copy — before the farmer draws for real.
It blocks the map underneath (scrim intercepts touches) and is dismissed
(Skip, or the CTA after one loop) exactly once per device, tracked in
`boundarySlice.drawTutorialSeen`.

**Context.** Reported directly: first-time users had no idea what to do on the
DRAW screen. Unlike a form, a satellite photo carries no affordance — nothing
on a field says "tap here" the way placeholder text does in an input. The
existing `BOUNDARY_HINTS.drawEmpty` status line ("Tap each corner of your
field on the map.") already says this, but a first-time user has no reason to
notice or trust a small status line before they've done anything.

**Alternatives.**
- *Text-only hint, louder* (bigger banner, arrow glyphs). Cheap, but still only
  tells you *that* to tap, not *what happens* — the exact gap the report named.
- *Static illustration* (three numbered dots and a drawn triangle as one image).
  Better than text, but a still image can't show the one thing that's actually
  hard to predict: that a line grows between your taps in real time. Screenshots
  from this exact investigation reinforced that — the animation *is* the
  information.
- *Non-blocking overlay* (demo plays in a corner while the real map stays
  interactive). Rejected: a stray tap during the demo drops a real point at an
  arbitrary spot before the farmer has seen the whole gesture, compounding the
  very confusion this exists to fix.
- *Per-field instead of per-device.* Rejected — the lesson is about the gesture,
  which doesn't change field to field; repeating it per field would be the
  nagging, not the teaching.

**Trade-offs.**
- ✅ Teaches the actual mechanic, not just its existence. ✅ Reuses real
  visuals/copy, so it can't drift out of sync with the real screen. ✅ Zero new
  dependencies — built on RN's built-in `Animated`. ✅ Blocking prevents the
  exact confused-stray-tap scenario a non-blocking demo would risk.
- ❌ One more thing a first-time farmer has to sit through before drawing —
  mitigated by Skip being visible from the first frame and the loop being short
  (~7.5 s).
- ❌ The line-growth tween is JS-driven (native driver can't animate `width`),
  so on a very low-end device it could show minor jank during that one ~400ms
  segment per edge. Everything else (hand movement, dot pop, ripple, fades) is
  native-driven and unaffected.

**Future impact.** Confined to `BoundaryDrawTutorial` and the one boolean flag.
A "replay the tutorial" affordance (e.g. a `?` button in the toolbar) is a
natural Phase-E addition — the component already takes `visible`/`onDismiss` as
plain props, so triggering it a second time needs no rework, only a new caller.

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
