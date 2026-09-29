# Farm Boundary — UX Design (Phase B)

The drawing experience, interaction by interaction. No code. This is what the
engine in [DRAWING_ENGINE.md](./DRAWING_ENGINE.md) has to serve, and what the
components in [ARCHITECTURE.md](./ARCHITECTURE.md) have to render.

Design principle, borrowed from ArcGIS Field Maps and Google Earth:

> **The user is always in exactly one mode, and always knows which.** Ambiguity
> between "am I panning the map or drawing on it?" is the single biggest usability
> failure of hand-rolled polygon tools. Modes are explicit, and the toolbar
> changes with the mode.

---

## 1. Entry

FieldDetails → Overview tab already shows a small map (`FieldLocationPreview`).
Add a button there:

- **No boundary yet:** primary button **"Draw field boundary"**.
- **Boundary exists:** the preview shows the polygon; button becomes
  **"Edit boundary"**, plus the area is shown as a stat.

Tapping either opens the full-screen `BoundaryEditor` route (D4). The editor is
**satellite by default** (D-requirement) and opens centred on the field's saved
pin, at a working zoom (~18) so the field roughly fills the screen.

---

## 2. The four modes

```
        ┌─────────────┐   tap "Draw"    ┌─────────────┐
        │   VIEW      │ ───────────────▶│   DRAW      │
        │ (read-only) │◀─────────────── │ (add verts) │
        └─────────────┘   done/cancel   └─────────────┘
              ▲                                │ polygon closed
              │ save                           ▼
        ┌─────────────┐   tap a vertex   ┌─────────────┐
        │  VIEW       │◀─────────────────│   EDIT      │
        │  (saved)    │                  │ (adjust)    │
        └─────────────┘ ────────────────▶└─────────────┘
                          tap "Edit"
```

| Mode | Map gestures | What taps do | Toolbar |
|---|---|---|---|
| **VIEW** | Pan / zoom / rotate free | Nothing (polygon is inert) | `Edit` · `Delete` · map-type · recentre |
| **DRAW** | Pan / zoom free | **Tap adds a vertex** at the tap point | `Undo` · `Redo` · `Close` · `Cancel` · vertex count · live area |
| **EDIT** | Pan / zoom free | Tap empty = deselect; tap handle = select | `Undo` · `Redo` · `Insert` toggle · `Done` · `Cancel` · live area |
| **(sub) VERTEX-SELECTED** | — | Drag handle = move; `Delete` button removes it | `Delete vertex` · `Deselect` |

Rotate/tilt stay available in every mode (map requirement), but are **off by
default** while drawing to avoid accidental disorientation — a compass button
re-levels north.

---

## 3. DRAW mode — the core interaction

Two placement methods, both supported; the user is not forced to choose:

### 3.1 Tap-to-place (primary)
Tap anywhere → a vertex appears there, connected to the previous one by an edge.
After the **third** vertex the shape is shown as a **filled, semi-transparent
polygon** (not just an open polyline), so the field reads as an area immediately.

### 3.2 Crosshair-place (precision, optional)
A fixed centre crosshair (we already own this: `MapCenterPin`) with an **"＋ Add
point"** button. The user pans the map so the crosshair sits on the exact corner,
then taps the button. This is the Google-Earth precision trick — the fingertip
never covers the target. Toggle between tap and crosshair with a small control;
default is tap.

### 3.3 Closing the polygon
Three ways, all standard:
- Tap **"Close"** in the toolbar (enabled at ≥ 3 vertices).
- Tap **near the first vertex** (within a snap radius) → snaps closed.
- The first vertex shows a subtle **"finish here"** ring once ≥ 3 vertices exist.

On close → transition to **EDIT** mode (not straight to save — the user almost
always wants to nudge one corner).

### 3.4 Live feedback during DRAW
- **Vertex count** and **live area** in the toolbar, updating on every add.
- The **current edge** (last vertex → finger/crosshair) can be shown as a dashed
  "rubber-band" line so the next segment is previewed. *(Nice-to-have; costs a
  re-render per move — gate behind a flag, evaluate on device.)*

---

## 4. EDIT mode — adjusting

- **Vertices are large, offset handles**, not tiny dots. A handle is a ~28–32 pt
  circle; the finger rests below the actual point (Trimble/DJI pattern) so the
  point is never hidden.
- **Drag a handle** → that vertex follows the finger; edges and area update live.
  On release the value commits to the undo stack (one drag = one undo step, not
  one-per-frame).
- **Insert a vertex:** each **edge midpoint** shows a smaller "ghost" handle.
  Dragging or tapping it creates a real vertex there and lets you position it.
  Ghost handles render **only when zoomed in enough** that edges are long on
  screen — otherwise they clutter (perf + UX).
- **Delete a vertex:** select it → **"Delete vertex"** button, **or** long-press
  the handle. Deletion is silent **except** when it would drop the polygon below
  3 vertices, which is blocked with a message.
- **Undo / Redo:** always visible, ≥ 20 steps. Covers add, move, insert, delete,
  and close.

---

## 5. Saving

- **"Save"** is enabled only when the polygon is **valid** (≥ 3 vertices, not
  self-intersecting, area above a floor). Invalid → the button is disabled and a
  one-line reason is shown ("Fix the crossing edge to save").
- On save: compute area + center + bbox, persist (locally in Phase D), return to
  VIEW with a success toast, and pop back to FieldDetails where the Overview map
  now shows the polygon and its area.
- **Acreage reconciliation** (open question Q1): if the field had a typed
  `areaAcres` and it differs from the drawn area by > ~5%, show a non-blocking
  note — "Typed: 4.0 ac · Drawn: 3.6 ac" — and let the user decide. The plan's
  assumption is **never silently overwrite** the typed value.

---

## 6. Screen-state catalogue

Every state the editor can be in, so nothing is discovered late:

| State | Trigger | UI |
|---|---|---|
| Loading imagery | Enter editor | Map + spinner; toolbar disabled |
| Empty / VIEW no-boundary | No saved polygon | "Draw field boundary" primary CTA, centred hint |
| DRAW 0 verts, first time ever | Tapped Draw, `drawTutorialSeen` false | Full-screen coach mark: a ghost fingertip taps three demo points, the real white line grows between them, closes and fills — see §10. Skip / "Got it" dismisses for good. |
| DRAW 0 verts | Tapped Draw | "Tap the field corners" coach hint, Cancel only |
| DRAW 1–2 verts | Adding | Points + open edges; Close disabled; area "—" |
| DRAW ≥ 3 verts | Adding | Filled polygon; Close enabled; live area |
| EDIT idle | Closed / opened saved | Handles + midpoint ghosts; Save/Done |
| EDIT vertex-selected | Tapped a handle | Selected handle emphasised; Delete-vertex shown |
| EDIT invalid | Self-intersection / area floor | Offending edges red; Save disabled + reason |
| Saving | Tapped Save | Buttons disabled, spinner on Save |
| Save error (future API) | API failure | Inline error, boundary kept in memory, retry |
| Imagery offline | Tiles fail | "Satellite imagery unavailable — drawing still works" banner |
| Discard confirm | Back with unsaved edits | Sheet: Keep editing · Discard |

---

## 7. Toolbar spec

Bottom toolbar (thumb-reachable), contents driven by mode:

```
VIEW :   [ Edit ]   [ ⋮ Delete ]              [ 🛰 type ]  [ ⊕ recenter ]
DRAW :   [ ↶ ][ ↷ ]   ●3  ·  1.24 ac          [ Cancel ]   [ Close ✓ ]
EDIT :   [ ↶ ][ ↷ ]   [ + Insert ]  1.24 ac   [ Cancel ]   [ Save ✓ ]
EDIT+sel:[ ↶ ][ ↷ ]   [ 🗑 Delete point ]      [ Deselect ] [ Save ✓ ]
```

- **Area is always visible** while drawing/editing (John Deere / FieldView
  pattern). Unit label tappable to cycle acres → ha → m² → ft².
- Map-type switcher reuses the `MapExplorer`/`AppMapView` `mapKind` control
  (satellite default). Satellite · Hybrid · Terrain · Map.
- Recentre reuses the existing `useMapCamera` fit-to-coordinates.

---

## 8. Accessibility & ergonomics

- All controls ≥ 44 pt targets; toolbar within thumb arc.
- Handles are 28–32 pt with generous hit-slop.
- Every mode transition is announced (screen-reader labels on mode buttons).
- Destructive actions (Delete boundary, Discard) confirm; Delete-vertex does not
  (it's cheaply undoable).
- Colour is never the only signal — invalid edges are red **and** carry the
  reason text (colour-blind safe).

---

## 9. What we reuse (so this isn't built from scratch)

| Need | Existing asset |
|---|---|
| The map surface, satellite, provider pinning, brand style | `AppMapView` (`src/maps`) |
| Camera control safe before `onMapReady` | `useMapCamera` |
| Centre crosshair for precision placement | `MapCenterPin` |
| Fit polygon into view | `camera.fitToCoordinates` + `regionContaining` |
| Coordinate validation, distance | `utils/geo.ts` (`isValidLatLng`, `distanceMeters`) |
| The polygon primitive | **to add** to `MapPrimitives.ts` (currently only Marker/Polyline/Callout) |
| Header, buttons, icons, toasts | `AppHeader`, `Button`, `AppIcon`, `showToast` |

The engine is new; almost everything around it already exists.

---

## 10. First-draw coach mark (added 2026-08-24)

A field is bare satellite imagery — nothing on it hints "tap here" the way a
form field's placeholder text does. First-time farmers opening DRAW mode had
no signal for what a tap does, so the first thing they saw was an empty map and
a status line they had no reason to read yet.

**What it is.** A full-screen coach mark, shown once per device, that plays a
silent demo of the exact gesture: a ghost fingertip taps a point, the same
white line the real map draws grows to the next tap, closes into a filled
triangle, then invites "now you try". It loops until dismissed.

**Why a live demo and not a static illustration.** A drawing tells you *that*
you tap corners; a demo tells you *what happens when you do* — the line
appearing in real time is the one thing a screenshot or a paragraph of copy
cannot convey. It also reuses the real vocabulary: the numbered dots are styled
like `VertexMarker`, the lines are the same white stroke `MapPolyline` uses
mid-draw, and the captions step through the exact `BOUNDARY_HINTS` text
(`drawEmpty` → `drawOne` → `drawTwo` → `drawReady`) the real toolbar shows next
— so the lesson and the real screen never disagree.

**Trigger.** Tapping "Draw field boundary" the first time `drawTutorialSeen` is
false in the persisted `boundary` slice (device-wide, not per-field — the
lesson is about the gesture, not the field). Dismissing it — Skip, or "Got it —
let's draw" once the loop completes — flips that flag for good; every
subsequent first tap in DRAW just gets the normal `drawEmpty` toast.

**Why it blocks the map underneath.** The scrim intercepts every touch while it
plays. Without that, a stray tap during the demo would drop a *real* point at
an arbitrary spot before the farmer had seen the whole gesture — confusing in
exactly the moment the coach mark exists to prevent.

**Component.** `src/maps/boundary/components/BoundaryDrawTutorial.tsx`. Built on
plain RN `Animated` (transform/opacity on the native driver; the line's growing
width is the one JS-driven tween, since layout properties can't run on the
native thread) — no new dependency. Full choreography and the on-device
verification are in
[docs/maps/CHANGELOG.md](../CHANGELOG.md).
