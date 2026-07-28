# Farm Boundary — Technical Architecture (Phase C intent)

Folder layout, component/hook/service boundaries, Redux shape, and the seams that
let this stay reusable. **No code** — interfaces and responsibilities only.

Overriding rule, inherited from the maps module:

> **UI renders. Hooks orchestrate. The engine computes. The repository persists.**
> No layer reaches past its neighbour. This is what makes the engine testable and
> the storage swappable.

---

## 1. Where it lives

It is a **sub-feature of the existing `src/maps/` module**, not a new top-level
folder. The boundary is map functionality; it reuses `AppMapView`,
`useMapCamera`, `MapCenterPin`, `utils/geo.ts` and the `MapPrimitives` seam. A
parallel `src/boundary/` would duplicate all of that and re-open the one-import
rule.

```
src/maps/
├── boundary/                       ◀── NEW sub-feature
│   ├── engine/
│   │   ├── boundaryReducer.ts      pure state machine: (draft, action) → draft
│   │   ├── boundaryActions.ts      addVertex | moveVertex | insertVertex |
│   │   │                           deleteVertex | close | undo | redo | reset
│   │   └── boundaryValidation.ts   min-verts · self-intersection · area floor
│   ├── hooks/
│   │   ├── useBoundaryDraft.ts     wraps the engine as React state + selectors
│   │   └── useBoundaryPersistence.ts  load/save via the repository (below)
│   ├── components/
│   │   ├── BoundaryPolygon.tsx     <Polygon> + fill/stroke, from engine state
│   │   ├── VertexHandle.tsx        draggable offset handle (one vertex)
│   │   ├── MidpointHandle.tsx      ghost "insert here" handle (one edge)
│   │   ├── BoundaryToolbar.tsx     mode-driven toolbar (see UX §7)
│   │   └── AreaReadout.tsx         live area + unit cycle
│   ├── services/
│   │   ├── boundaryRepository.ts   INTERFACE + local (redux) implementation
│   │   └── boundarySerializer.ts   LatLng[] ⇄ GeoJSON (order + closure)
│   └── types.ts                    FieldBoundary, DraftBoundary, GeoJSONPolygon
│
├── utils/geo.ts                    ← ADD: polygonAreaSqMeters, centroid, bbox,
│                                          segmentsIntersect, unit conversions
└── components/MapPrimitives.ts     ← ADD: export Polygon as MapPolygon

src/screens/farms/
└── BoundaryEditorScreen.tsx        ◀── NEW route; thin — wires hooks to components

src/redux/
├── slices/boundarySlice.ts         ◀── NEW; keyed by fieldId; persisted
└── (navigationTypes)               ← ADD: BoundaryEditor route param
```

---

## 2. Layer responsibilities

| Layer | Owns | Must NOT |
|---|---|---|
| `engine/` | Vertex state, undo/redo, validation, all as **pure functions** | Import React, the map SDK, Redux, or the API |
| `hooks/` | Adapt the engine to React; orchestrate load/save; own the mode | Contain geometry maths (that's the engine) or JSX |
| `components/` | Render map children + toolbar from props | Hold business state or call services |
| `services/` | Persist (repository) and (de)serialise | Know about React or the SDK |
| `screens/` | Wire hooks ↔ components; navigation | Contain engine or persistence logic |
| `utils/geo.ts` | Pure geodesic maths (area, centroid, intersection) | Anything impure |

This mirrors the maps module's existing `utils`-is-pure / `hooks`-own-policy /
`components`-render split, so it reads as the same codebase.

---

## 3. The engine as a pure reducer

The heart of the module is a **pure reducer**, not a class and not a hook:

```
boundaryReducer(draft: DraftBoundary, action: BoundaryAction): DraftBoundary
```

- Deterministic: same `(draft, action)` → same result. **Unit-testable with zero
  mocks** — the whole reason validation and area live here, not in a component.
- `useBoundaryDraft` is a thin `useReducer` wrapper exposing selectors
  (`vertices`, `area`, `canUndo`, `canClose`, `validation`) and bound action
  dispatchers. Components never touch the reducer directly.
- Undo/redo is inside the reducer (past/future stacks), not a separate library —
  it's ~15 lines and a dependency here would be overkill.

Because it is pure and coordinate-only, the **same engine powers GPS-walk**
(Phase E): GPS just feeds `addVertex` from `watchPosition` instead of from taps.

---

## 4. State: local component state vs Redux

- **The in-progress draft lives in the screen** (`useBoundaryDraft`), **not in
  Redux.** A half-drawn polygon is ephemeral UI state; putting every drag frame
  through Redux would be noise and a performance trap.
- **Only the committed boundary goes to Redux** (`boundarySlice`), on save. That
  slice is persisted (`redux-persist`) and is what other screens read.
- This matches how the app already treats forms (local state) vs saved entities
  (Redux) — e.g. `AddFieldScreen` holds form state locally, commits via a thunk.

`boundarySlice` shape:
```
boundary: {
  byFieldId: Record<string, FieldBoundary>   // saved boundaries
  // no loading/error zoo in Phase D: local repo is synchronous.
  // Phase E adds saving/error per field when the API lands.
}
```

---

## 5. The repository seam (the swap point)

The single most important architectural line. `useBoundaryPersistence` depends on
an **interface**, never on Redux or the API directly:

```
interface BoundaryRepository {
  load(fieldId): Promise<FieldBoundary | null>
  save(boundary: FieldBoundary): Promise<FieldBoundary>   // returns w/ bumped version
  remove(fieldId): Promise<void>
}
```

- **Phase D:** `localBoundaryRepository` — reads/writes the persisted Redux slice.
  Synchronous under the hood, Promise-shaped so the seam doesn't change later.
- **Phase E:** `apiBoundaryRepository` — the `PATCH …/boundary` contract from
  [DATA_MODEL §4](./DATA_MODEL.md#4-backend-contract-phase-e--hand-this-to-the-backend-team),
  plus a sync/merge policy. Swapping is **one binding**; no component, hook or
  engine file changes.

This is the concrete meaning of "backend later without a rewrite."

---

## 6. Navigation

- New route `BoundaryEditor: { farmId; fieldId }` in `AppStackParamList`
  (`navigation/navigationTypes.ts`), registered in `AppNavigator`.
- Entry from `FieldDetailsScreen` Overview (UX §1). Uses the existing native-stack
  push; the editor is a full-screen route with its own header.
- Reuses the `pop`-to-ancestor navigation convention already noted in project
  memory to return cleanly to FieldDetails after save.

---

## 7. What we reuse vs what is new

**Reused (no change):** `AppMapView`, `useMapCamera`, `MapCenterPin`,
`AppHeader`, `Button`, `AppIcon`, `showToast`, `redux-persist` setup,
`isValidLatLng` / `distanceMeters` / `roundCoordinate` / `regionContaining`,
the `field` sync-tag wiring.

**New, additive to existing files:**
- `MapPrimitives.ts` gains a `MapPolygon` export (with a comment saying which
  feature needs it — the module's standing rule).
- `geo.ts` gains `polygonAreaSqMeters`, `centroid`, `boundingBox`,
  `segmentsIntersect`, `findSelfIntersections`, and area-unit conversions — all
  pure, all unit-testable, consistent with the file's charter.

**New, self-contained:** everything under `src/maps/boundary/`, the
`BoundaryEditorScreen`, the `boundarySlice`.

---

## 8. Testing strategy

| Layer | How |
|---|---|
| `engine/` + `geo.ts` additions | **Pure unit tests.** Known rings → known area (compare to surveyed reference values); intersection fixtures; undo/redo sequences. No native module needed — this is the payoff of keeping them pure. |
| `boundarySerializer` | Round-trip `LatLng[]` → GeoJSON → `LatLng[]`; assert order flip + closure handled. |
| Repository | Local impl against a test store; interface conformance so the API impl can reuse the same suite. |
| Components | Render-prop level; handle drag callbacks fire the right actions. |
| Manual / device | The Phase-D acceptance checklist in [README §8](./README.md#8-production-readiness-checklist-to-satisfy-before-phase-d-ships): real fields, both platforms, 200-vertex drag, offline imagery, restart persistence. |

Blocked today: the repo's `jest` setup is broken (pre-existing `jest@25` vs
`@react-native/jest-preset@0.86`, logged in `docs/maps/CHANGELOG.md`). The engine
and `geo.ts` are written pure **specifically so they become testable the moment
that is fixed** — this is a reason to fix Jest, not a reason to entangle them.

---

## 9. Security & integrity (Phase-D scope)

- **Authorisation:** the editor is only reachable for a field the user already
  owns (they navigated from their own FieldDetails). Server-side ownership checks
  arrive with the API (Phase E) — the existing field routes already enforce
  owner scoping, so the boundary sub-route inherits it.
- **Accidental loss:** undo/redo + discard-confirm on back + persisted drafts
  (a backgrounded half-draw survives). Delete-boundary confirms.
- **Integrity:** the invariants in [DATA_MODEL §6](./DATA_MODEL.md#6-data-integrity-rules-invariants)
  — derived values always come from the ring via one function set; `version`
  monotonic.
- **Audit / recovery:** deferred to the versioned-history table (ADR-B05) when
  sync lands; `version` is in place now so history is additive.
