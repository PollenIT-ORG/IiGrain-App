# Farm Boundary — Drawing Engine Design (Phase C intent)

How the engine behaves. **No implementation** — this is the contract the Phase-D
code must satisfy, written so it can be reviewed and argued with first.

The guiding rule: **the engine is pure state + pure functions. It knows nothing
about `react-native-maps`, nothing about Redux, nothing about the API.** It takes
a vertex list and an action, and returns a new vertex list plus derived facts
(area, validity). That is what makes it unit-testable without a native module,
and reusable for GPS-walk and import later.

---

## 1. The state the engine owns

Conceptually (types finalised in Phase C):

```
DraftBoundary {
  vertices:  LatLng[]          // ordered ring, NOT closed (no duplicated last point)
  closed:    boolean           // has the user finished the ring?
  selected:  number | null     // index of the selected vertex in EDIT
  past:      Snapshot[]        // undo stack
  future:    Snapshot[]        // redo stack
}
Snapshot = { vertices: LatLng[], closed: boolean }   // enough to restore
```

Design notes:

- **The ring is stored open** (first point not repeated at the end). "Closed" is
  a boolean, not a duplicated vertex. Rendering closes it; area/validation close
  it mathematically. This avoids the classic "is the last point real or the
  closing echo?" bug.
- **Coordinates are `LatLng`** from `src/maps/types.ts` — the same type the whole
  map module already speaks. No new coordinate type.
- **Precision:** every stored vertex is rounded to `COORDINATE_PRECISION` (6 dp,
  ≈ 11 cm) via the existing `roundCoordinate` — matching what the backend column
  will hold, so what is shown equals what is stored.

---

## 2. How vertices are created

- **DRAW / tap:** the map's `onPress` yields a `LatLng` (already rounded by
  `AppMapView`). The engine appends it. No vertex is created for a tap that
  lands within the **duplicate-radius** of the previous vertex (prevents double
  taps making coincident points).
- **DRAW / crosshair:** the "＋ Add point" button reads the map centre
  (`onCenterChange` gives it continuously) and appends that.
- **EDIT / insert:** an edge-midpoint ghost handle, when engaged, splits that
  edge — the new vertex is inserted **between** the two edge endpoints at the
  correct array index (not appended), so the ring order stays valid.

---

## 3. How the polygon closes

- Allowed only at **≥ 3 vertices**.
- Triggered by the Close button, or by a tap within **snap-radius** of vertex 0,
  or by dragging the current point onto vertex 0.
- Closing sets `closed = true` and transitions the UI to EDIT. It does **not**
  add a vertex.
- Snap-radius is defined in **screen space** (points), converted to a distance at
  the current zoom — so "near the first point" means near *on screen*, regardless
  of zoom level.

---

## 4. Editing operations (each is one undo step)

| Op | Rule |
|---|---|
| **Move** (drag) | Marker `onDragEnd` gives the new `LatLng`; engine replaces `vertices[i]`. Live edges follow during the drag (`onDrag`) but only `onDragEnd` commits to undo — one drag = one step. |
| **Insert** | Splits an edge at its midpoint ghost; new vertex at index `i+1`. |
| **Delete** | Removes `vertices[i]`. Blocked (with a message) if it would leave < 3. |
| **Select / deselect** | Pure UI state; not an undo step. |
| **Close** | Sets `closed = true`; one undo step. |

---

## 5. Undo / Redo

- Command-stack model: before any mutating op, push a `Snapshot` of the current
  ring to `past`, clear `future`. Undo pops `past` → `future`; redo the reverse.
- **Depth ≥ 20.** Snapshots are shallow `LatLng[]` copies — cheap; even 20 copies
  of a 200-vertex ring is trivial memory.
- Drag commits **once** (on release), so undo rewinds a whole drag, not a frame.
- Undo/redo availability = `past.length > 0` / `future.length > 0`; drives the
  toolbar button enabled state.

---

## 6. Validation

Two tiers — **live** (cheap, every change) and **on-commit** (thorough, on close
and on save).

### 6.1 Live (every change)
- Vertex count badge.
- Area readout (see §8).
- Duplicate-point prevention at creation time (duplicate-radius).

### 6.2 On-commit (close & save)
| Check | Rule | On failure |
|---|---|---|
| **Min vertices** | ≥ 3 | Save disabled; "Add at least 3 points" |
| **Self-intersection** | No two non-adjacent edges cross | Offending edges red; Save disabled; "Fix the crossing edge" |
| **Area floor** | area ≥ `MIN_AREA_SQM` (e.g. 10 m²) | Save disabled; "This area is too small" |
| **Degenerate** | Not all points collinear (area ≈ 0) | Same as area floor |

**Self-intersection algorithm (design):** classic segment–segment intersection
over all non-adjacent edge pairs. O(n²) is fine at farmland vertex counts
(tens). If a field ever exceeds a few hundred vertices, switch to a
Bentley–Ottmann sweep — noted, not built. The engine exposes
`findSelfIntersections(vertices): Array<[edgeA, edgeB]>` so the UI can highlight
exactly which edges are wrong.

### 6.3 Duplicate / coincident
- **At creation:** ignore a tap within the duplicate-radius of the previous
  vertex.
- **After a drag onto another vertex:** detected on commit; treated as
  degenerate and flagged, so the user either moves it back or deletes one.

---

## 7. Performance

The one screen in this app where a native view is mutated continuously.

- **Vertex handles are custom marker views** → `tracksViewChanges={false}` once
  settled (the module's standing rule; `useSettledMarker` pattern from
  `VisitMap`). A dragging handle is the exception while it moves.
- **A drag updates one vertex**, producing a new array by index replacement — the
  polygon re-renders, the *other* handles do not change identity, so React
  reconciles minimally.
- **Midpoint "insert" ghosts render only when zoomed in** past a threshold —
  otherwise a 200-vertex ring would mount 200 extra markers. Fewer markers when
  zoomed out, where you can't place precisely anyway.
- **The `<Polygon>` itself is cheap** — it's one native shape; cost is in the
  handles, not the fill.
- **Area recompute is O(n)** and runs on commit / on drag-end, not per frame.
- **Target:** smooth drag at ~200 vertices on a mid-range Android device
  (Phase-D acceptance). 1000-vertex stress is a Phase-E test, likely requiring
  handle virtualisation (render only handles within the viewport).

---

## 8. Area calculation

- **One function**, `polygonAreaSqMeters(vertices): number`, used for **both** the
  live readout and the persisted `area_sqm`. They can never disagree.
- **Method:** spherical excess (the standard geodesic polygon-area formula on a
  sphere of Earth's radius). Accurate to well within the ~2% product target at
  field scale, and needs no projection. This is a pure addition to
  `src/maps/utils/geo.ts`, which already holds the geodesic helpers
  (`distanceMeters`, `regionContaining`).
- **Unit conversions** are pure and exact:
  - 1 hectare = 10 000 m²
  - 1 acre = 4 046.8564224 m²
  - 1 m² = 10.763910417 ft²
- **Live display** formats to a sensible precision (2 dp acres/ha, integer m²);
  the **stored** value is the raw `area_sqm` — formatting is a display concern
  only.

Derived-on-save alongside area:
- **center** = centroid (or `regionContaining` centre) — for map framing and the
  future single-pin fallback.
- **bbox** = min/max lat/lng — for cheap "is this field near X" filtering before
  any spatial DB exists.

---

## 9. Coordinate & storage model (summary — full in DATA_MODEL)

- In memory: `LatLng[]`, open ring, 6-dp rounded.
- Persisted: a GeoJSON-style **closed** ring (first point repeated at the end, per
  the GeoJSON spec) plus derived `area_sqm`, `center`, `bbox`, `polygon_version`,
  `syncStatus`. The open↔closed conversion happens at the repository boundary,
  once, so the engine never deals with the duplicated echo point.

---

## 10. What the engine explicitly does NOT do

- It does not talk to the map SDK (the screen wires engine state → `<Polygon>` /
  handles).
- It does not talk to Redux or the API (the repository does).
- It does not smooth or simplify automatically (Douglas–Peucker simplification is
  a Phase-E option, exposed as an explicit user action, never silent — a farmer's
  corner must not move on its own).
- It does not handle holes or multi-ring polygons (Phase-E; the data model leaves
  room — see DATA_MODEL §5).
