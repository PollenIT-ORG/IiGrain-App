# Offline Mode — Architecture, Feasibility and SQLite Audit

**Status: discovery and design only. Nothing has been implemented.**
No application code, `package.json`, dependency, schema, Redux slice, API or UI was
changed while producing this. Everything below was read from the actual codebase
(`iiGrain/src`, `iiGrain/android`, `iiGrain/ios`) and from the backend source
(read-only, for idempotency and constraint evidence).

---

## Contents

| Doc | What it answers |
|---|---|
| [01 — Current app flow](01-current-app-flow.md) | Navigation tree, bootstrap, fetch mechanism, what is persisted today |
| [02 — API audit & feasibility matrix](02-offline-feasibility-matrix.md) | Every endpoint the app calls, and the per-feature offline verdict |
| [03 — SQLite evaluation](03-sqlite-evaluation.md) | Library comparison and the recommendation |
| [04 — Database architecture](04-database-architecture.md) | Proposed tables, keys, indexes, and what stays out of SQLite |
| [05 — Farmer offline flow](05-farmer-offline-flow.md) | Step-by-step feasibility for the farmer |
| [06 — Assessor offline flow](06-assessor-offline-flow.md) | Assessment-only scope, and the visit gate |
| [07 — Assessment offline design](07-assessment-offline-design.md) | Template caching, evidence redesign, JSON vs normalised |
| [08 — Location and maps](08-location-and-map-offline.md) | GPS vs tiles vs geocoding, and the boundary story |
| [09 — Sync architecture](09-sync-architecture.md) | Outbox, ordering, flush algorithm (design only) |
| [10 — IDs and conflicts](10-id-and-conflict-strategy.md) | local/server ids, idempotency evidence, conflict analysis |
| [11 — Files and media](11-files-and-media.md) | Photo/document capture, storage, upload queue |
| [12 — Android & iOS](12-android-ios-considerations.md) | Platform differences and constraints |
| [13 — Security & isolation](13-security-and-data-isolation.md) | Encryption, logout, multi-user on one device |
| [14 — Implementation roadmap](14-implementation-roadmap.md) | Phased plan, architecture decision, migration strategy |
| [15 — Testing strategy](15-testing-strategy.md) | Test matrix including failure and platform scenarios |
| [16 — iOS validation](16-ios-validation.md) | What is unverified on iOS and how to verify it |
| [17 — Domain adapters](17-domain-adapters.md) | How each domain syncs, parent resolution, dependency chains |
| [Status](OFFLINE_STATUS.md) | Current state: what works offline today, what does not |

---

## What are we building?

Complete offline-first support for the **Farmer** application — browse, create and
edit farms, fields, boundaries, soil, monitoring records and assessments with no
connectivity — plus **offline Assessment only** for the **Assessor**.

Not: offline login, offline maps, offline enrolment, offline visit tracking.

---

## Where the app is today

There is **no offline support of any kind**. Three findings define the starting point:

1. **A cold start with no network logs the user out.** `bootstrapThunk`
   (`src/redux/slices/authSlice.ts:53`) calls `GET /auth/me` and clears the Keychain
   in its `catch`. A network failure is indistinguishable from a revoked session.
2. **Almost nothing is persisted.** `redux-persist` whitelists only
   `user.profile`, `assessmentProgress.resumeByField`, `dashboard.selectedFarmId`,
   `boundary`, and `onboarding`. Every farm, field, assessment and monitoring list
   is memory-only and empty on relaunch.
3. **Offline failures are loud and useless.** `services/http.ts` retries a
   response-less request twice (~2.4 s) and then raises a global error toast, on
   every screen, on every fetch.

One counter-example worth knowing: the **boundary module is already local-first** —
persisted store, a `'local' | 'pending' | 'synced' | 'conflict'` status type, a
local-then-remote repository, and even the right user-facing copy when an upload
fails. It is missing only a sync engine, and it is the template for everything else.

---

## What can work offline

| | Farmer | Assessor |
|---|---|---|
| **Fully offline** | Session restore · farm list & detail · field list & detail · field details/soil/documents (cached) · GPS coordinate capture · **boundary drawing and editing** · all nine monitoring forms (definitions are compiled into the app) · assessment list, summary, questions, score guidance · **answering and re-answering questions** · resume · locally derived progress and review · opening already-downloaded documents | Session restore · assigned work list · assessment summary, categories, questions · **answering questions** · resume · review |
| **Partially offline** (works locally, syncs later) | Create/edit farm · create/edit field · boundary upload · soil save · monitoring records · capture photos/documents · submit assessment · profile edit | Capture evidence · submit assessment |
| **Online required** | First login · signup/OTP/password reset · map tiles & satellite imagery · reverse geocoding (address text) · programme enrolment · live dashboard/RHI numbers · notifications · visit tracking · account deletion / password change | All of the above, **plus starting a visit** (the access gate) |

---

## What cannot work offline — the honest list

* **First login.** No local credential store, and none should be added.
* **Map tiles / satellite imagery.** Google tiles are fetched on demand; there is no
  `UrlTile`, no tile cache, no offline region anywhere in the code. Coordinates and
  polygons still work perfectly on a blank basemap.
* **Reverse geocoding.** `services/geocoding.ts` calls
  `nominatim.openstreetmap.org`. Today this is a **hard functional blocker**, not a
  cosmetic one: `LocationPicker.tsx:261` disables Confirm until an address resolves,
  so **a location cannot be picked offline at all**, which in turn makes field
  creation impossible. Fixing that one line is one of the highest-value changes in
  the plan.
* **Programme enrolment.** Capacity is allocated server-side (`userLimit`,
  `isFull`). A queued enrolment can be refused after the farmer was told it worked —
  and assessments are program-scoped, so a failed enrolment invalidates every answer
  captured under it.
* **Live RHI / dashboard numbers.** Server-computed. Offline answers will not move
  them until sync; they must be shown as snapshots with an "as of" timestamp.
* **Assessor visit gate.** Assessment access derives from a live `activeVisit`
  (`useAssessorAssessmentFlow.ts:82`), which is API- and socket-driven and not
  persisted. Requires a product decision — see below.
* **Resumable uploads.** No chunked/resumable endpoint exists; a 10 MB video
  interrupted at 90% restarts from zero.
* **Duplicate-safe creation of farms, fields and monitoring records.** See Risks.

---

## Recommended database

**`@op-engineering/op-sqlite`** (18.1.4, published 2026-08-21, ~173k downloads/week).

* The only strong candidate that adds **no second dependency** — `expo-sqlite`
  requires the `expo` package even in bare RN, and `react-native-nitro-sqlite`
  requires `react-native-nitro-modules`. This app is bare RN 0.84.1 with a
  hand-tuned Podfile and patched packages; fewer native moving parts is worth a lot.
* JSI/C++, New-Architecture-friendly, ships its own SQLite (removes OS version
  variance), transactions, prepared statements, TypeScript.
* **SQLCipher is available as a compilation target**, so the encryption decision in
  [13](13-security-and-data-isolation.md) stays reversible without a library migration.

**Fallback:** `react-native-nitro-sqlite` — the only candidate with a contractual
`react-native >= 0.75` peer range, maintained by a team rather than one person.

**Mandatory gate:** neither library documents RN 0.84 verification. Phase 2 starts
with a build spike on real Android and iOS hardware before any schema code is written.

Do **not** add an ORM. ~14 tables with simple access patterns; hand-written SQL in a
repository layer is far easier to reason about while debugging sync.

---

## What is stored locally

```
app_meta · users
farms · fields · field_boundaries · field_soil
programs · program_fields
assessments · assessment_categories · assessment_questions · assessment_answers
monitoring_records · documents · media_files
dashboard_snapshots · notifications
sync_queue · sync_state
```

Explicitly **not** in SQLite: tokens (Keychain/Keystore), passwords and OTPs (never
persisted), binaries (filesystem), live visit trails, loading/error flags, draft
undo/redo stacks, navigation state.

---

## Data flow

### Today

```
API ──► axios ──► thunk ──► Redux ──► UI
                    │
                    └── on failure: error toast, state stays null
```

### Proposed

```
                          UI (screens)
                               │
                     Redux + hooks  ← UI state only
                               │
                       Repository layer
                      /                \
                SQLite                 API (axios)
          (source of truth)         (remote authority)
                    │                      ▲
              sync_queue ──────────────────┘
                    │
             Sync engine (Phase 8+)
                    ▲
   NetInfo · socket 'sync' · app foreground · manual pull
```

Reads always come from SQLite. Writes go to SQLite **and** `sync_queue` in one
transaction. Screens never learn whether they are online.

### Offline write lifecycle

```
User action → SQLite row (sync_status='local') + sync_queue entry
           → UI updates immediately, shows a Pending badge
Connectivity returns
           → flush in FIFO order, respecting parent→child dependencies
           → rebuild each request body from the CURRENT row (never a stale snapshot)
           → on success: write server_id, sync_status='synced', unblock dependants
           → invalidate the affected sync tags → pull fresh server state
```

---

## How synchronisation will work later

Designed in [09](09-sync-architecture.md), **not built**. Key decisions:

* **Outbox** (`sync_queue`), FIFO by insertion, with `depends_on_id` for parent→child
  ordering derived from the APIs themselves (a field CREATE needs a *server* farm id).
* **Reference, not snapshot.** The queue stores a pointer to the row; the request
  body is rebuilt at flush time. Three separate requirements force this — edit
  coalescing, evidence URL assembly, and the backend's partial-update semantics.
* **Foreground-only.** Both Android (Doze + OEM killers) and iOS (opportunistic
  BGTask) make background sync unreliable, so it is not attempted.
* **Reuse what exists**: the `syncTags` vocabulary, `WRITE_INVALIDATIONS`, the
  `bumpSyncEpoch()` reconnect recovery, and `handleApiError().kind === 'offline'` —
  which is already implemented and currently unused.
* **Detect conflicts, do not resolve them silently.** The backend has no versioning
  or `If-Match`, so last-write-wins is implied. Surface divergence to the user
  instead of pretending to arbitrate it.

---

## Major risks

| # | Risk | Severity | Where |
|---|---|---|---|
| 1 | `bootstrapThunk` clears tokens on an offline `/auth/me` — a cold start offline logs the user out | **Blocking** | [01](01-current-app-flow.md), [05](05-farmer-offline-flow.md) |
| 2 | `LocationPicker` cannot confirm without a reverse-geocoded address → no offline field creation | **Blocking** | [08](08-location-and-map-offline.md) |
| 3 | **Duplicate farms/fields/monitoring records** when a create succeeds but its response is lost — no client ids, no idempotency keys, no unique constraints | **High** | [10](10-id-and-conflict-strategy.md) |
| 4 | No backend versioning → silent last-write-wins over hours instead of milliseconds | **High** | [10](10-id-and-conflict-strategy.md) |
| 5 | Logout with a non-empty queue destroys unsynced work | **High** | [13](13-security-and-data-isolation.md) |
| 6 | Assessment evidence must upload *before* the answer can be saved — a real redesign, not a config change | Medium | [07](07-assessment-offline-design.md) |
| 7 | Picker files live in purgeable temp directories; a queued upload can find its file gone | Medium | [11](11-files-and-media.md) |
| 8 | Phase 3 rewires five slices to read through repositories — the largest refactor in the plan | Medium | [14](14-implementation-roadmap.md) |
| 9 | Assessor devices would hold many farmers' PII and GPS locations | Medium | [13](13-security-and-data-isolation.md) |
| 10 | No library is documented as RN-0.84-verified | Medium | [03](03-sqlite-evaluation.md) |
| 11 | Process death on iOS backgrounding will cut flushes mid-flight | Medium | [12](12-android-ios-considerations.md) |
| 12 | No resumable uploads — large media may never complete on a weak connection | Low–Medium | [11](11-files-and-media.md) |

---

## What to implement first

```
1  Connectivity + session survival     ← ship alone; kills risks 1 and the toast storm
2  SQLite foundation (build spike first)
3  Read-cache the farmer's world       ← ship alone; the app becomes browsable offline
4  Offline location + boundaries       ← small; kills risk 2, unblocks 5 and 8
5  Outbox + offline farm creation      ← first write; proves the engine
6  Offline assessments (farmer)        ← the payoff
7  Offline assessments (assessor)
8  Offline fields, soil, monitoring
9  Media outbox
10 Conflict detection + pull safety
11 Multi-user + security hardening
12 Field testing + production hardening
```

Phases 1, 3 and 6 are each independently shippable and independently valuable.

---

# Executive summary

## Recommended architecture
`API → Repository → SQLite (source of truth) → Redux (UI state) → UI`, with a
durable `sync_queue` outbox and a foreground-only sync engine. Adopted incrementally,
one domain at a time; the existing boundary module already follows this pattern and
proves it fits.

## Recommended SQLite technology
`@op-engineering/op-sqlite`, with `react-native-nitro-sqlite` as the fallback if a
Phase 2 build spike on RN 0.84 + New Architecture fails. No ORM.

## Farmer offline capabilities
Browse everything cached; create and edit farms and fields; capture GPS coordinates;
draw and edit boundaries; record soil data; complete all nine monitoring forms;
download, answer, resume, review and submit assessments; capture photos and documents
for later upload; open previously downloaded documents.

## Assessor offline capabilities
Restore the session; see the assigned work list; open a downloaded assessment;
answer, resume, review and submit — provided the visit was started while online
(recommended option) or the visit gate is relaxed by a product decision.

## Online-only capabilities
First login, signup/OTP/password reset, map tiles and satellite imagery, reverse
geocoding, programme enrolment/unenrolment, live dashboard and RHI figures,
notifications, visit tracking, assessment comparison, password change, account
deletion.

## Backend changes required
None are required to ship the plan. Two are **strongly recommended**, in priority
order:

1. **Accept a client-supplied UUID on create** for farms, fields and monitoring
   records (`INSERT … ON CONFLICT (id) DO NOTHING RETURNING`). This eliminates risk 3
   entirely *and* removes the whole local-id→server-id resolution chain — the single
   highest-leverage change available. Alternatively an `Idempotency-Key` header, or
   unique constraints so a duplicate fails loudly.
2. **A `version` column plus `If-Match` / 409** on the mutable entities, so conflicts
   can be detected server-side instead of silently lost (risk 4).

Nothing in the backend was modified. Two client-side facts worth noting, both
verified in the backend source: **saving an assessment answer and submitting an
assessment are already true upserts** (`ON CONFLICT … DO UPDATE`), so those replay
safely with no backend work at all — which is precisely why assessments are the
recommended flagship offline feature.

## Android risks
Doze, App Standby and OEM battery managers make background sync unreliable →
foreground-only. Low-memory process death → write-through to SQLite, never
save-on-unmount. "Clear storage" wipes the DB but may leave Keychain tokens →
a "token present, DB empty" recovery path is required. `ExternalDirectoryPath` may
sit on removable storage → put the media outbox on `DocumentDirectoryPath`.

## iOS risks
Suspension within seconds of backgrounding and termination with no callback → every
queue entry must be safe to re-run, and `in_flight` must reset to `queued` on launch.
`NSTemporaryDirectory()` (where the image picker writes) is purgeable → files must be
copied into the outbox at pick time. The DB must live in Application Support, never
`Library/Caches`. `use_frameworks!` forces op-sqlite onto system SQLite and needs the
documented Podfile workaround.

## Security risks
Farm and field GPS coordinates plus boundary polygons are the most sensitive data and
would become durable on the device. OS-level encryption (app-private storage +
device encryption with a lock screen) is the proportionate baseline; SQLCipher is
recommended only if a contract, the assessor multi-farmer case, or a DPA obligation
demands it — and op-sqlite keeps that decision reversible. Tokens must stay in
Keychain and never enter SQLite. Logging out with unsynced work must warn, never
silently destroy.

## Sync risks
Duplicate creates on lost responses (risk 3), silent last-write-wins without backend
versioning (risk 4), attachment loss if outbox files are purged (risk 7), dependent
subtrees orphaned when a parent is deleted server-side, and flushes cut short by
process death. Each has a stated mitigation; risks 3 and 4 cannot be *fully* solved
on the client.

## Implementation order
Phases 1 → 12 as listed above. Phases 1, 3 and 6 are each independently shippable.

## Open questions (need a product or backend decision)

1. **Assessor visit gate** — persist the active visit and allow offline assessment
   within a bounded window (recommended), allow offline visit start (weakens visit
   provenance), or keep the gate strictly online? *Blocks Phase 7; must be decided
   during Phase 6.*
2. **Offline enrolment** — keep online-only (recommended), or queue it as a
   *request* with an explicitly pending UI state?
3. **Offline discard of an assessment** — permit it, or online-only? Replaying a
   stale discard could delete answers made elsewhere.
4. **Encryption at rest** — is SQLCipher contractually or legally required?
5. **Cache retention after logout** — retain per-user indefinitely, retain 30 days
   (recommended), or purge on every logout?
6. **Client-supplied UUIDs on create** — will the backend team accept the change that
   eliminates the duplicate-record risk?
7. **Offline search semantics** — when server-side search is unavailable, fall back
   to a local `LIKE` over cached rows (recommended, clearly labelled), or disable
   search entirely?
8. **Static satellite snapshot per field** as an offline basemap substitute — worth
   building if drawing on a blank canvas proves unusable in the field?
9. **Dashboard/RHI staleness copy** — how should a number that is knowingly out of
   date be presented to a farmer?
10. **iOS backup policy** for the outbox — back up pending media (survives a device
    restore, inflates iCloud backups) or exclude it?
