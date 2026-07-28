# BEST_PRACTICES — working inside the map module

Rules for anyone touching `src/maps/` or building a screen on top of it. Each
one exists because breaking it has a specific, known cost — that cost is stated,
so you can make an informed exception rather than a blind one.

---

## 1. The rules, ranked

### 1.1 Import from `src/maps`, never from `react-native-maps`

```ts
import { MapExplorer, type MapEntity } from '../../maps';        // ✅
import AppMapView from '../../maps/components/AppMapView';       // ❌ bypasses the barrel
import MapView, { Marker } from 'react-native-maps';             // ❌ never
```

**Cost of breaking it:** a screen that renders its own `MapView` silently loses
`PROVIDER_GOOGLE` pinning, the brand map style, and the disabled Android
toolbar — so it looks different on iOS, ignores the design system, and can
deep-link the user out of the app. It also re-couples the app to the vendor,
which is the thing the module exists to prevent.

Only three files may import the vendor: `AppMapView.tsx`, `MapPrimitives.ts`,
and `mapStyle.ts` (type-only).

### 1.2 Never render a map with a controlled `region`

Move the camera through `useMapCamera`, never by feeding `region` back into the
map from state.

**Cost:** every pan emits a region change → parent re-renders with the *old*
region → the map snaps back. The map fights the user's finger.

### 1.3 Always route camera calls through `useMapCamera`

```ts
const { mapRef, onMapReady, camera } = useMapCamera();
camera.animateToCoordinate(coord, MAP_ZOOM.PRECISE);   // safe before ready
```

**Cost:** the SDK silently drops camera calls made before `onMapReady`. On a
warm start with a fast device this never reproduces; on a cold start or a
mid-range phone the map opens at the country view and never moves — with no
error anywhere.

### 1.4 Keep `AppMapView`'s `children` referentially stable

```ts
const markerNodes = useMemo(() => <>{items.map(…)}</>, [items, onSelect]);
```

**Cost:** `AppMapView` is `React.memo`'d, and `children` is a prop. Rebuilding
the marker array on every render defeats the memo and re-renders a **native**
view subtree. On a screen with a search box that is once per keystroke.

### 1.5 Set `tracksViewChanges={false}` on settled markers

Markers with custom React children rasterise that view to a bitmap on every
frame while this is `true`.

**Cost:** measurable frame-rate loss for the whole session — worst on Android,
worst on lists, worst exactly where maps matter.

**But:** starting at `false` makes Android capture an empty frame → a blank
square. If the marker has children, start `true` and flip after ~600 ms
(`useSettledMarker` in `VisitMap.tsx` is the reference implementation). A marker
using the SDK's default pin bitmap (`pinColor`, no children) can be `false`
immediately.

### 1.6 Validate coordinates before rendering

```ts
entities.filter(e => isValidLatLng(e.coordinate))
```

**Cost:** `NaN`/`undefined` coordinates render nothing and log nothing —
invisible data loss. `null` coordinates render at `(0, 0)`, a pin in the
Atlantic that reads as data corruption to the user.

### 1.7 Round coordinates to `COORDINATE_PRECISION` before persisting

`AppMapView.onCenterChange` already does this. Six decimals ≈ 11 cm, and matches
the backend's `NUMERIC(9,6)`.

**Cost:** the value stored differs from the value shown, so re-opening an edit
screen moves the pin a hair — which looks like the app lost the user's input.

### 1.8 Magic numbers go in `config/mapDefaults.ts`

Zoom levels, animation durations, thresholds, padding.

**Cost:** a tuning request ("the picker opens too zoomed out") becomes a hunt
through JSX instead of a one-line diff.

### 1.9 `utils/` stays pure

No React, no vendor imports, no I/O.

**Cost:** it is the only part of the map stack that is unit-testable without a
native module. Importing React into `geo.ts` gives that up permanently.

### 1.10 Throttle anything billed

Directions is billed per request. `useRouteToDestination` re-requests only after
40 m of movement **and** 8 s.

**Cost:** a naive `useEffect(fetchRoute, [origin])` issues one billed call per
GPS tick — thousands per visit, per user.

### 1.11 Inside a native `<Modal>`, use `Alert` — not the app toast

**Cost:** a native `<Modal>` is a separate window; the root-level `GlobalToast`
renders *behind* it and is invisible. The user gets no feedback at all.
`LocationPicker` uses `Alert` for this reason; `MapExplorer` uses a toast
because it is never rendered inside a Modal — if that changes, this flips.

### 1.12 A search input over a map gets **no `onBlur`**

**Cost:** blur fires *before* the tap on a result lands, so closing the results
panel there makes every result un-tappable on iOS. Close on selection, on
submit, or on a map tap instead.

---

## 2. Reusing `MapExplorer`

`MapExplorer` is the "browse N labelled points, find one, tap it" surface. It is
domain-free — it renders `MapEntity[]`, not farms.

**Adding a second consumer should cost a `useMemo` and a few props. If you are
about to copy the component to change one behaviour, add a prop instead.**

### 2.1 The pattern

Every consumer has exactly three domain-specific parts:

1. **Where the data comes from** — a Redux selector, usually.
2. **How one record becomes a pin** — an adapter function.
3. **What the action button does.**

### 2.2 Reference consumer — farms

`src/screens/help/FieldMapScreen.tsx`, ~130 lines, almost all of it the adapter:

```ts
const farmToEntity = (farm: Farm): MapEntity<Farm> => ({
  id: farm.id,
  coordinate: { latitude: farm.latitude as number, longitude: farm.longitude as number },
  title: farm.name,
  subtitle: farm.location,
  meta: `${farm.areaAcres} acres · ${farm.fieldsCount} fields`,
  pinColor: STATUS_PIN_COLOR[farm.status],
  searchText: `${farm.ownerName} ${farm.soilType}`,   // searchable, not shown
  data: farm,
});

<MapExplorer<Farm>
  entities={entities}
  loading={loading}
  searchGroupLabel="Your farms"
  actionLabel="View farm"
  onAction={entity => navigation.navigate('FarmDetails', { farmId: entity.id })}
/>
```

### 2.3 Worked example — a fields map for one farm

Nothing about the component changes:

```ts
const fieldToEntity = (field: Field): MapEntity<Field> => ({
  id: field.id,
  coordinate: { latitude: field.latitude as number, longitude: field.longitude as number },
  title: field.name,
  subtitle: `${field.crop} · ${field.season}`,
  meta: `${field.areaAcres} acres · ${field.healthLabel}`,
  pinColor: HEALTH_PIN_COLOR[field.status],
  searchText: field.crop,
  data: field,
});

<MapExplorer<Field>
  entities={fields.filter(f => isValidLatLng(f)).map(fieldToEntity)}
  searchGroupLabel="Fields"
  searchPlaceholder="Search fields…"
  // A field map is scoped to one farm — flying to Paris is not a useful result.
  placeSearchEnabled={false}
  formatCountLabel={n => `${n} of ${fields.length} fields mapped`}
  actionLabel="Open field"
  onAction={e => navigation.navigate('FieldDetails', { farmId, fieldId: e.id })}
/>
```

### 2.4 Choosing props

| Situation | Props |
|---|---|
| Data is scoped (one farm's fields, one org's farms) | `placeSearchEnabled={false}` |
| Read-only overview, no navigation target | omit `actionLabel` / `onAction` |
| Card needs charts, badges, more than three lines | `renderDetail` |
| Empty state needs an illustration or a custom CTA | `renderEmpty` |
| Aerial-first surface (crop inspection) | `initialMapKind="satellite"` |
| Static display, no browsing | `searchEnabled={false}`, `showFitAllControl={false}` |
| Selection must drive state outside the map | `onSelectEntity` |

### 2.5 When NOT to use it

- **Picking a coordinate** → `LocationPicker` / `LocationPickerModal`. Different
  interaction: a fixed centre pin, not a set of markers.
- **One fixed point, read-only** → `FieldLocationPreview`. Lighter, no search,
  no controls.
- **Live tracking with a route** → `VisitMap`. It owns routing and follow
  behaviour that `MapExplorer` deliberately does not.
- **Drawing a polygon** → not built yet. See
  [FUTURE_SCOPE.md §1.2](./FUTURE_SCOPE.md). Do **not** bolt vertex editing onto
  `MapExplorer`; it is a different mode with its own state machine.

---

## 3. Adding a vendor primitive

`Polygon`, `Circle`, `Geojson`, `Heatmap`, `UrlTile` and `Overlay` all exist in
`react-native-maps` and are deliberately **not** exported yet.

To add one:

1. Export it from `src/maps/components/MapPrimitives.ts` **with a comment saying
   which feature needs it**. That file is the audit list of what the app can
   draw.
2. Re-export from `src/maps/index.ts`.
3. Add a CHANGELOG entry.
4. If it introduces a new failure mode (polygons render nothing when the ring is
   self-intersecting, for instance), add it to TROUBLESHOOTING.md.

---

## 4. Performance checklist for any new map screen

- [ ] Map `children` memoised
- [ ] `tracksViewChanges={false}` once markers have settled
- [ ] Coordinates validated before render
- [ ] Local search filters a **precomputed** lowercase index, not raw objects
- [ ] Network search debounced and `AbortController`-cancellable
- [ ] Result lists capped, `renderItem` and `keyExtractor` stable
- [ ] No billed API call in an unthrottled effect
- [ ] Redux fetch guarded — check
      [the shared-slot refetch pattern](./ARCHITECTURE.md#23-layering-rules)
      before dispatching a list thunk from a second screen

---

## 5. Review checklist for a map PR

- [ ] Nothing outside `src/maps/` imports `react-native-maps`
- [ ] No new magic numbers outside `config/`
- [ ] `utils/` still pure
- [ ] Behaviour verified on **both** platforms — iOS silently falls back to
      Apple MapKit when the Google pod is missing, and the difference is only
      visible side by side
- [ ] CHANGELOG entry written
- [ ] Any native config change also documented in CONFIGURATION.md
- [ ] Any new failure mode added to TROUBLESHOOTING.md
