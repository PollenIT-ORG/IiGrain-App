# DECISION_LOG — architecture decisions for the map module

Every significant decision, in the form: **Decision · Context · Alternatives ·
Trade-offs · Future impact**.

This exists so a future team can tell the difference between *a deliberate
choice with a known cost* and *an accident nobody has fixed yet*. Reversing
anything here is fine — but do it knowing what the original constraint was.

Status: `Accepted` · `Accepted, revisit` · `Superseded` · `Open`

---

## ADR-001 — Google Maps as the map provider

**Status:** Accepted · 2026-07-23

**Decision.** Google Maps Platform, on both Android and iOS.

**Context.** The product is an agriculture platform operating on rural Indian
farmland. Requirements: accurate rural roads and imagery, bundled satellite
imagery for the GIS roadmap, live routing for assessor visits, and one visual
result across platforms.

**Alternatives.**
- *Apple MapKit* — iOS only, weak outside metros. Half a solution.
- *OpenStreetMap / Leaflet* — free, but see ADR-003.
- *Mapbox* — capable, vector base is OSM-derived, metered, no team familiarity.

**Trade-offs.**
- ✅ Best-in-class rural coverage; satellite/hybrid included; one SDK, two
  platforms; team already knows it.
- ❌ Billed per map load. ❌ Requires Google Play Services on Android, so
  de-Googled devices cannot render maps at all. ❌ No user-controlled offline
  regions — the one roadmap item Google actively blocks (ADR-009).

**Future impact.** Cost scales with usage, so quota caps and budget alerts are a
release gate, not a nicety ([SECURITY.md §7](./SECURITY.md)). Offline support
will need a second renderer or a snapshot fallback.

---

## ADR-002 — `react-native-maps` as the binding

**Status:** Accepted · 2026-07-23

**Decision.** `react-native-maps@1.29.0`.

**Context.** The app runs React Native 0.84 with the **New Architecture enabled**
(`newArchEnabled=true`, `RCTNewArchEnabled`). A binding without Fabric support
was a hard blocker.

**Alternatives.**
- *Write our own native module* — two platforms of gesture and lifecycle bugs to
  own forever, for no capability we do not already get.
- *A WebView-based map* — rejected, see ADR-003.

**Trade-offs.**
- ✅ De-facto standard, actively maintained, Fabric-ready. ✅ Ships `Marker`,
  `Polyline`, `Polygon`, `Geojson`, `Heatmap`, tile overlays — so the entire GIS
  roadmap is prop work, not native work. ✅ Exposes the escape hatches that make
  live tracking viable (`tracksViewChanges`, `fitToCoordinates`).
- ❌ A third-party dependency in the critical path of a core module. ❌ Its
  iOS Google support is opt-in and fails *silently* (ADR-005).

**Future impact.** A major version bump is a scheduled, tested piece of work.
ADR-004 is what keeps the blast radius small.

---

## ADR-003 — Retiring Leaflet-in-a-WebView

**Status:** Accepted · 2026-07-23 · **Supersedes** the previous map stack

**Decision.** Delete `src/components/location/*` — the Leaflet + OpenStreetMap
WebView implementation — rather than keep it alongside the native maps.

**Context.** Four screens rendered maps in a `react-native-webview` running
Leaflet, loading the library from `unpkg.com` and tiles from
`tile.openstreetmap.org`, with routing from `router.project-osrm.org`.

**Why it had to go.**
1. Two public CDNs were runtime dependencies. Offline or blocked → grey
   rectangle. The old code even had a `'Leaflet failed to load — no internet /
   CDN blocked'` branch, which is an admission that this happened.
2. OSM's tile policy explicitly forbids production use; we were one traffic
   spike from every map going grey.
3. A string round-trip over the JS bridge per pan, and a second JavaScript
   context in memory on top of Hermes.
4. OSRM's demo server carries a "not for production" notice and no SLA.
5. No satellite imagery — requirement for the GIS roadmap would have forced a
   second migration.

**Alternatives.**
- *Keep both, migrate gradually* — considered and rejected: two map stacks means
  every bug reproduced twice and two visual languages in one product.
- *Keep Leaflet for previews only* — same objection, smaller.

**Trade-offs.**
- ✅ One stack, native gestures, no CDN dependency, no policy violation.
- ❌ A large single change rather than a staged one. ❌ Introduces per-load
  billing where there was none.

**What was deliberately kept.** Nominatim for search and reverse geocoding, and
the picker's interaction design (fixed centre pin, lifting shadow, save gated on
a resolved address). Both were good; only the renderer was the problem.

**Future impact.** `react-native-webview` remains a dependency — it is used
elsewhere. Do not remove it as "map cleanup".

---

## ADR-004 — The one-import rule

**Status:** Accepted · 2026-07-23

**Decision.** Only `AppMapView.tsx`, `MapPrimitives.ts` and `mapStyle.ts`
(type-only) may import `react-native-maps`. Everything else — including every
screen — imports from `src/maps`.

**Context.** The vendor is the most likely thing in this module to change: a
major bump, a MapLibre fallback for offline (ADR-009) or for de-Googled devices.

**Alternatives.**
- *Let screens import the vendor directly* — simpler today, and it makes every
  future migration a whole-codebase change.
- *Wrap every primitive in our own component* — impossible: `react-native-maps`
  discovers `Marker`/`Polyline` by component identity, so wrapping breaks the
  native view tree. Hence `MapPrimitives.ts` re-exports instead of wrapping.

**Trade-offs.**
- ✅ A renderer swap touches `src/maps/components/` only. ✅ Provider pinning,
  brand style and disabled chrome cannot be bypassed. ✅ `MapPrimitives.ts` is a
  one-screen audit of what the app can draw.
- ❌ One extra indirection. ❌ **Enforced by review, not by lint** — see
  Technical Debt in the CHANGELOG.

**Future impact.** If violated twice, add `react-native-maps` to
`no-restricted-imports` in `.eslintrc.js` with an override for `src/maps/**`,
mirroring the existing AppText guardrail.

---

## ADR-005 — Google (not Apple MapKit) on iOS

**Status:** Accepted · 2026-07-23

**Decision.** Opt in to the `react-native-maps/Google` CocoaPods subspec so iOS
renders Google, not Apple MapKit.

**Context.** `react-native-maps` defaults to Apple MapKit on iOS.

**Why.** Apple MapKit **silently ignores `customMapStyle`** — our entire brand
map style. Marker anchoring, gesture inertia and callout behaviour also differ.
Choosing Apple means either dropping the styling or maintaining two visual
designs, and reproducing every visual bug twice.

**Trade-offs.**
- ✅ Identical tiles, styling and behaviour on both platforms.
- ❌ ~5–8 MB larger iOS binary. ❌ iOS map loads are billed. ❌ **The failure
  mode is silent**: without the subspec the podspec defines `HAVE_GOOGLE_MAPS 0`
  and `provider="google"` falls back to Apple Maps with no error. Only a
  side-by-side comparison catches it — which is why it is steps 1 and 7 of the
  SETUP verification checklist.

**Future impact.** Revisit if iOS map cost becomes material. The switch is one
Podfile line, but expect visual regressions across every map screen.

---

## ADR-006 — Key delivery through the build system, three separate chains

**Status:** Accepted · 2026-07-23

**Decision.** One `.env` variable, `MAPS_API_KEY`, read independently by Gradle,
by CocoaPods and by Babel.

**Context.** The native SDKs are initialised **before JavaScript exists** —
Android reads the merged manifest at process start, iOS must be keyed before the
first `GMSMapView`. Neither can be handed a value from the JS bundle, so
`react-native-dotenv` alone cannot solve this.

**Alternatives.**
- *Hardcode the key* — committed secret; see ADR-007.
- *`react-native-config`* — it is already an (unused) dependency and provides
  native access, but it requires an Xcode build-phase script and a `dotenv.gradle`
  apply. That is more moving parts than a 20-line Gradle function and a Podfile
  hook, for the same result.
- *Write into `project.pbxproj`* — that file **is** committed, so the secret
  would be too, plus a permanently dirty diff.

**Trade-offs.**
- ✅ No committed secret. ✅ CI overrides via `$MAPS_API_KEY` with no `.env` on
  disk. ✅ Missing key warns instead of failing, so non-map work is never
  blocked.
- ❌ Three code paths to keep in sync. ❌ **Different refresh semantics**:
  Android re-reads every build, JS needs `--reset-cache`, iOS needs
  `pod install`. This trips up everybody once, so it is called out in
  SETUP, CONFIGURATION and TROUBLESHOOTING.

---

## ADR-007 — Restrictions, not secrecy, as the security control

**Status:** Accepted · 2026-07-23

**Decision.** Treat the API key as **extractable** and defend with Google Cloud
API + application restrictions.

**Context.** An `.apk` and an `.ipa` are zip files. Anyone can read
`AndroidManifest.xml` or `Info.plist`. A shipped mobile app cannot hold a secret.

**Trade-offs.**
- ✅ Package + SHA-1 (Android) and bundle id (iOS) restrictions make an
  extracted key useless without our private signing key — which is what actually
  needs protecting.
- ❌ Depends on correct Cloud Console configuration, which is not in version
  control and cannot be code-reviewed. The pre-release checklist in SECURITY.md
  is the only guard.

**Known trap.** With Play App Signing, the installed APK's fingerprint is
**Google's**, not the upload key's. Registering only the upload SHA-1 gives maps
that work in internal testing and are blank for every Play Store user.

---

## ADR-008 — Google Directions for routing, with a known unrestrictable key

**Status:** **Accepted, revisit** · 2026-07-23

**Decision.** Route the assessor-tracking polyline via the Google Directions
API, called from JavaScript, using `Env.MAPS_API_KEY`.

**Context.** The previous OSRM demo server is not production-grade, and an
OSM-derived route visibly leaves the road when drawn over Google's tiles.

**The problem this decision carries.** Directions is a **web service** API.
Google supports only IP/referrer restrictions on those — not package name or
bundle id. So this key **cannot be locked to this app**, unlike the SDK key.

**Alternatives.**
- *Keep OSRM* — free and needs no key, but unreliable and visually inconsistent
  with the base map.
- *Backend proxy* — correct, and not yet built.

**Trade-offs.**
- ✅ Routes agree with the tiles; accurate ETAs; already-paid platform.
- ❌ A key on the device that cannot be app-restricted.

**Mitigations, in order.** (1) Proxy through our own backend — `DIRECTIONS_BASE_URL`
is the single line that changes, and the parsed response shape is already
Google's so a pass-through proxy needs no client change. (2) Until then, a
**separate** Directions-only key with a hard daily quota. (3) Never reuse the
SDK key here.

**Future impact.** This is the top pre-release item in
[FUTURE_SCOPE.md §0](./FUTURE_SCOPE.md). Revisit and supersede this ADR when the
proxy ships.

---

## ADR-009 — Nominatim retained for search and reverse geocoding

**Status:** Accepted · 2026-07-23

**Decision.** Keep OpenStreetMap's Nominatim for place search and reverse
geocoding, even though the tiles are now Google's.

**Context.** Migrating the renderer did not require migrating the geocoder.

**Alternatives.** *Google Places / Geocoding API* — better Indian address data,
but billed per session, and it is a **web service** API, so it carries the same
unrestrictable-key problem as ADR-008.

**Trade-offs.**
- ✅ Free, already integrated, already tuned (the reverse-geocode result
  formatting in `services/geocoding.ts` is non-trivial and works).
- ❌ Address quality is below Google's in rural India. ❌ Nominatim's usage
  policy expects light, attributed use. ❌ Search results and map tiles come from
  two different datasets, so a searched place can land slightly off its Google
  label.

**Future impact.** If address quality becomes a complaint, moving to Places is a
change inside `services/geocoding.ts` only — but do it behind the backend proxy
from ADR-008, not directly from the device.

---

## ADR-010 — A cohesive `src/maps/` feature module

**Status:** Accepted · 2026-07-23

**Decision.** Put every map concern in one folder, breaking the flat
`components/ hooks/ services/ config/ types/ utils/` layout used elsewhere.

**Context.** Maps own code in every layer: components, hooks, services, config,
types, utils.

**Alternatives.** *Follow the flat structure* — nine files across five
directories with nothing naming them as one system. "Add polygon support" starts
with a scavenger hunt.

**Trade-offs.**
- ✅ Cohesion; one public barrel; a renderer swap has an obvious boundary.
- ❌ The first structural inconsistency in `src/`. Accepted deliberately:
  cohesion beats consistency when a feature owns code in every layer.

**Future impact.** This is the shape to copy for the next feature module.

---

## ADR-011 — An imperative camera, not a controlled `region`

**Status:** Accepted · 2026-07-23

**Decision.** Maps are uncontrolled (`initialRegion`); the camera moves through
`AppMapHandle` / `useMapCamera`.

**Context.** A controlled `region` prop is the obvious React shape, and it is
wrong here.

**Why.** User pans → `onRegionChange` → `setState` → re-render with the
*previous* region → the map snaps back. The map fights the finger.

**Trade-offs.**
- ✅ Gestures feel native; no fighting; camera movement is modelled as the
  animation it actually is.
- ❌ Less "React-idiomatic"; camera position is not in React state, so a screen
  that genuinely needs it must track it via `onCenterChange`.

**Consequence.** Camera calls before `onMapReady` are silently dropped by the
SDK, which is why `useMapCamera` buffers and replays the last command. Without
that buffer, screens that know their coordinate at mount fail on cold starts
only — invisible in development.

---

## ADR-012 — `MapExplorer` is domain-free

**Status:** Accepted · 2026-07-23

**Decision.** Extract the browse/search/select map surface out of
`FieldMapScreen` into a reusable `MapExplorer` component driven by a domain-free
`MapEntity` shape.

**Context.** The behaviour was written for farms. The roadmap needs the same
interaction for fields, assessors, scheduled visits and soil samples — none of
which share a data shape, all of which are "a labelled point you can find and
tap".

**Alternatives.**
- *Leave it in the screen and copy it per consumer* — four near-identical
  600-line screens, and a fix to the iOS `onBlur` trap applied in one of them.
- *Make it generic over the domain type with per-entity render props* — more
  flexible, far heavier to call, and it pushes map knowledge back into screens.

**Trade-offs.**
- ✅ A new consumer costs a `useMemo` adapter plus props. ✅ Performance guards
  (memoised markers, precomputed search index, capped results) are written once.
  ✅ Interaction traps (no `onBlur`, `tracksViewChanges`, coordinate validation)
  are fixed once for everyone.
- ❌ A wide prop surface (~20 props). Accepted: they are all optional with
  sensible defaults, and grouping them into config objects would make the common
  call site worse.
- ❌ `data?: TData` is a typed escape hatch that can be abused to smuggle
  behaviour into entities. It is for identity and callback payloads only.

**Boundary.** `MapExplorer` is **not** the place for coordinate picking
(`LocationPicker`), single-point display (`FieldLocationPreview`), live tracking
(`VisitMap`), or polygon drawing (not built — it is a different mode with its own
state machine, and bolting it on here would be a mistake).

**Future impact.** New map surfaces should start by asking "can `MapExplorer` do
this with a prop?" See the recipes in
[BEST_PRACTICES.md §2](./BEST_PRACTICES.md#2-reusing-mapexplorer).

---

## Template

```markdown
## ADR-0NN — Title

**Status:** Proposed | Accepted | Accepted, revisit | Superseded by ADR-0MM · DATE

**Decision.** One sentence.
**Context.** What forced the choice.
**Alternatives.** What else was considered, and why it lost.
**Trade-offs.** ✅ gains / ❌ costs. Be honest about the costs.
**Future impact.** What this makes easy, and what it makes expensive.
```
