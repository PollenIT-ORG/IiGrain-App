# 14 — Implementation Roadmap (planning only)

Nothing in this roadmap has been built. Phases are ordered by **dependency and
risk**, not by feature appeal.

---

## Part 0 — Two decisions that must be made before Phase 1

### 0.1 Cache, or source of truth?

**Option A — API → Redux, SQLite as a side cache**

```
API ──► Redux ──► UI
  └──► SQLite (write-behind, read only when offline)
```
* Cheapest. Barely touches existing screens.
* But there are now **two** sources of truth. Every screen needs "am I online?"
  branching, the two copies drift, and an offline write has no home.
* Dead end: it cannot grow into offline writes without being rewritten.

**Option B — API → SQLite → Redux → UI** *(recommended)*

```
API ──► Repository ──► SQLite ──► Redux (UI state) ──► UI
                          ▲
                     sync_queue ──► Sync engine ──► API
```
* One source of truth. Screens never know whether the data came from a fetch.
* Redux keeps doing what it is genuinely good at — UI state, loading flags,
  selectors, the existing `useSyncedFetch` tag mechanism — and stops being a
  transient copy of server data.
* Offline writes have an obvious home.
* More work per slice, and every thunk changes shape.

**Recommendation: B**, with a strict division:

| Layer | Owns |
|---|---|
| SQLite | Durable domain data + the outbox. The only source of truth. |
| Redux | UI state: loading, errors, `requestedX` guards, selections, search text, and a hydrated projection of SQLite for rendering. |
| API | The remote authority. Reached only by the repository layer and the sync engine. |

Adopt B **incrementally, one domain at a time**. The boundary module already works
this way (`08` §3) and is the proof that the pattern fits this codebase.

### 0.2 Migration strategy

`PRAGMA user_version` is the schema version. A single ordered migration runner,
run once at startup before any query:

```
migrations = [ (1, sql...), (2, sql...), ... ]
current = PRAGMA user_version
for (v, sql) in migrations where v > current:
    BEGIN; run sql; PRAGMA user_version = v; COMMIT
```

Rules:
* **Forward-only.** No down-migrations; nobody downgrades an app store build.
* **Additive by default.** `ADD COLUMN` with defaults, new tables, new indexes.
  Destructive changes use the 12-step `CREATE new / INSERT SELECT / DROP / RENAME`
  dance inside one transaction.
* **Never destroy the queue.** If a migration would drop a `sync_queue` column,
  flush or export the queue first. Losing a farmer's unsynced day to a schema change
  would be the worst possible bug in this project.
* **Cached read data is disposable.** If a migration for `farms`/`fields`/questions
  gets hairy, truncating and re-pulling is legitimate — *provided* `sync_status` is
  `synced` for every row being dropped. Rows with local changes must be migrated
  properly or surfaced, never silently dropped.
* **Test path:** install version N, create offline data, upgrade to N+1, verify both
  the data and the queue. This is a required test for every phase that touches the
  schema (`15`).
* Existing `redux-persist` state (`PERSIST_VERSION = 1`) is a separate versioning
  system. Where a slice moves into SQLite (`boundary` first), write a one-time
  import that reads the persisted slice, inserts into SQLite, and marks it migrated
  in `app_meta`.

---

## Phase 1 — Connectivity + session survival *(the highest value per unit of work)*

**Goal:** the app stops actively misbehaving offline.

* Add `@react-native-community/netinfo`; add a `net` slice (`online`, `type`,
  `isExpensive`, `lastOnlineAt`).
* Fix `bootstrapThunk`: on `handleApiError().kind === 'offline'`, **keep the
  session** and mark it unverified instead of clearing the Keychain.
* Persist `auth.user` (or hydrate it from the already-persisted `user.profile`) so
  the role and identity survive a cold offline start.
* Global offline banner; suppress the error-toast storm for `kind === 'offline'`.
* `useSyncedFetch`: do not fire `run()` while offline.
* Short-circuit `http.ts` when NetInfo says definitely-offline, so the 2.4 s retry
  ladder stops running on every screen.

**Files:** `redux/slices/authSlice.ts`, `redux/store.ts`, `services/http.ts`,
`hooks/useSyncedFetch.ts`, `navigation/RootNavigator.tsx`, new `redux/slices/netSlice.ts`,
new `components/OfflineBanner`.

**DB:** none. **API:** none. **Backend:** none.

**Risks:** the bootstrap change touches the login gate — the highest-blast-radius
file in the app. Needs a careful test matrix (`15`).

**Done when:** with airplane mode on, the app cold-starts to the farmer shell (empty
but logged in), shows an offline banner, and raises zero error toasts.

---

## Phase 2 — SQLite foundation

**Goal:** a database exists, opens on both platforms, and survives restarts.

* Build spike first (`03`): op-sqlite on a real Android device and a real iOS device
  on RN 0.84 + New Architecture. 1000-row transaction, restart, read back. If it
  fails, fall back to `react-native-nitro-sqlite` before writing any schema code.
* `services/db/` — connection singleton, WAL, migration runner, `app_meta`,
  transaction helper, typed query helper.
* Schema v1: `app_meta`, `users`, `sync_state`.
* Startup order: open DB → migrate → resolve `active_user_id` → then render.

**Risks:** native build breakage; `use_frameworks!` on iOS (`12`); Android OEM
storage quirks. All discovered by the spike, which is why the spike comes first.

**Done when:** a value written to `app_meta` survives a force-quit and reinstall-free
restart on both platforms, and the migration runner takes an empty DB to v1.

---

## Phase 3 — Read-cache the farmer's world

**Goal:** the app is fully browsable offline. Still no offline writes.

* Tables: `farms`, `fields`, `field_boundaries`, `field_soil`, `programs`,
  `program_fields`, `dashboard_snapshots`, `documents`.
* Repository layer per domain: `read from SQLite` + `pull from API and upsert`.
* Rewire `farmSlice`, `fieldSlice`, `fieldDetailsSlice`, `dashboardSlice`,
  `enrollmentSlice` to read through repositories.
* Migrate `boundarySlice.byFieldId` → `field_boundaries` (one-time import).
* "Last updated <time>" affordance on every cached surface.
* Local `LIKE` search fallback when server search is unavailable.

**Risks:** the biggest refactor of the project. Do it **one slice at a time**, each
independently shippable. Watch for the known single-slot refetch-loop trap in the
shared caches.

**Done when:** aeroplane mode, cold start → farms, fields, field details, cached
documents and the dashboard snapshot all render, with honest staleness labels.

---

## Phase 4 — Offline location and boundaries

**Goal:** unblock offline capture of coordinates and polygons.

* `LocationPicker`: allow Confirm without a resolved address (`08` §2) —
  small change, large unlock.
* Store `address_resolved = 0`; queue nothing yet, just resolve on next foreground
  while online.
* Blank-basemap UX: "Map imagery unavailable offline" chip; keep pan/zoom/pin and
  polygon rendering working.
* Point `useBoundaryRepository`'s `LocalBoundaryStore` at SQLite.

**Risks:** low. The boundary engine is pure geometry and already local-first.

**Done when:** offline, a GPS pin can be confirmed and a boundary drawn, saved, and
re-opened after an app restart.

---

## Phase 5 — Outbox skeleton + offline farm creation

**Goal:** the first offline write, end to end, on the simplest entity.

* `sync_queue` + `sync_state` tables; enqueue/coalesce logic; `depends_on_id`.
* `local_id` / `server_id` on `farms`; UUID generation.
* Minimal flush engine: FIFO, backoff, `in_flight` reset on launch, single-flight
  lock (mirror the `refreshPromise` pattern in `http.ts`).
* Ambiguous-failure handling for CREATE — **do not blind-retry** (`10` §2).
* "Pending sync" badge on locally-created farms.

**Risks:** duplicate farms (`10`). Ship the verification heuristic **and** the
user-facing warning in the same phase, not later.

**Done when:** offline → create a farm → force-quit → reopen → farm is still there
with a Pending badge → go online → it syncs, gets its `server_id`, badge clears.

---

## Phase 6 — Offline assessments (farmer) *(the payoff phase)*

**Goal:** answer a whole assessment offline.

* Wire the missing bulk endpoint
  `GET /assessments/my/programs/{p}/fields/{f}/categories/{c}/questions`
  into `config/endpoints.ts` and `assessmentApi` (`07` §3). **First task of the phase.**
* Verify the per-field independence of the question template with one API diff
  before caching it per-program (`04`, `07` §2).
* Tables: `assessments`, `assessment_categories`, `assessment_questions`,
  `assessment_answers`.
* "Download for offline" per field, with progress and a badge.
* Answers write to SQLite + queue; progress counters and the review screen derived
  locally instead of fetched.
* Queue answer UPDATEs and the SUBMIT (submit strictly last per program+field).
* Pre-flush guard: re-check `locked` / `COMPLETED` before pushing (`10` §3).

**Risks:** none of the catastrophic kind — the API is idempotent. The real risk is
UI drift between locally-derived progress and the server's numbers; make the
"pending sync" state visible rather than pretending.

**Done when:** download a field's assessment, go offline, answer 20 questions with
comments, kill the app, reopen, resume at the right question, go online, everything
syncs and the server totals match.

---

## Phase 7 — Offline assessments (assessor)

**Goal:** the same, plus the visit gate.

* Cache `/assessor/fields` and the active visit (`06` §2, option A).
* Persist `activeVisit` with a bounded validity window; decide the window with the
  business.
* Reuse Phase 6's tables and engine wholesale — only the API adapter changes
  (`useAssessorAssessmentFlow` already isolates this).
* Route-level prefetch: "download all my assigned fields".

**Risks:** the visit-gate product decision is a **blocker for this phase** and must
be settled during Phase 6, not at the start of Phase 7.

**Done when:** an assessor starts a visit online, loses signal, completes the whole
assessment, regains signal, and it syncs.

---

## Phase 8 — Offline fields, soil and monitoring

**Goal:** the rest of the farmer's write surface.

* `local_id`/`server_id` on `fields` and `monitoring_records`.
* Dependency chain farm → field → record enforced via `depends_on_id`.
* Boundary inlined into the field CREATE.
* Soil PUT queued (idempotent).
* Nine monitoring forms writing locally; field-point seeding reconciled by `lat/lng`.

**Risks:** duplicate fields and records — same class as Phase 5, now with a
dependency chain that must not deadlock. Test parent-fails-child-blocked explicitly.

---

## Phase 9 — Media outbox

**Goal:** photos and documents captured offline actually arrive.

* `media_files` table + `outbox/<user>/` directory; copy-at-pick (`11` §2).
* Upload queue entries; parent re-write for assessment evidence (`07` §5).
* Missing-file reconciliation on startup; storage caps and purge policy.
* Defer large uploads on expensive connections.

**Risks:** silent attachment loss is the failure mode to design against. Every lost
file must surface to the user with the record it belonged to.

---

## Phase 10 — Conflict detection and the pull side

**Goal:** stop pulls from clobbering local work, and make divergence visible.

* Pull never overwrites `local` / `pending` rows (`09` §7).
* `conflict` state + a "Needs your attention" screen with Keep-mine / Keep-server.
* Parent-deleted-server-side handling for dependent subtrees.
* Document the backend versioning request formally (`10` §3).

**Risks:** this phase is where the honest limits of a version-less backend become
user-visible. Better here, deliberately, than as a silent data-loss bug in Phase 6.

---

## Phase 11 — Multi-user, security and lifecycle hardening

* `owner_user_id` filtering enforced in the repository layer, with a test that
  asserts it.
* Logout guard for a non-empty queue (`13` §5).
* Retention policy on logout; "Sign out and remove my data".
* `deleteAccountThunk` total purge.
* `device_install_id` restored-backup quarantine (`12`).
* SQLCipher decision revisited (`13` §3).

---

## Phase 12 — Field testing and production hardening

* Real-device matrix (`15`), including an OEM-aggressive Android handset.
* A real day in a real field with no signal, with a real farmer and a real assessor.
* Telemetry: queue depth, flush success rate, conflict count, oldest pending entry
  — logged locally and surfaced in a debug screen. You cannot operate a sync system
  you cannot observe.
* Rollout behind a flag, farmer-first, assessor second.

---

## Sequencing summary

```
1  Connectivity + session survival      ← ship alone, immediate value, low risk
2  SQLite foundation (spike first)
3  Read-cache the farmer's world        ← ship alone, large perceived value
4  Offline location + boundaries        ← small, unblocks Phase 5 and 8
5  Outbox + offline farm creation       ← first write; proves the engine
6  Offline assessments (farmer)         ← the payoff
7  Offline assessments (assessor)
8  Offline fields, soil, monitoring
9  Media outbox
10 Conflict detection + pull safety
11 Multi-user + security hardening
12 Field testing + production hardening
```

Phases 1, 3 and 6 are each independently shippable and independently valuable.
If the project is ever cut short, cutting after 6 leaves a genuinely useful product;
cutting after 3 still leaves a much better one than exists today.
