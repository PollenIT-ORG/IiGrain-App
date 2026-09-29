# Offline-First — Status

Last updated: 2026-09-14 (last-known-good data + assessment offline package)

## Snapshot

| | |
|---|---|
| Tests | **633 / 633 passing, 44 suites** (full run 2026-09-14, after the last-known-good work and the code-review fix). No suite logged after completion and no test sent a request to the real assessment API. One earlier run showed Jest's "a worker process has failed to exit gracefully" notice -- not attributed |
| Code review | ECC `code-reviewer` agent: 0 CRITICAL, **1 HIGH -- fixed** (offline summary header count not updated after an online save; see "Local work always wins") |
| TypeScript | **PASS** (`tsc --noEmit`, exit 0) |
| ESLint | **0 errors**, 13 warnings (2026-09-15). The 58 errors are gone: `jest.setup.js` now declares the Jest environment (`/* eslint-env jest */`), and dead code (unused imports, variables, a leftover tab-indicator animation and an unnecessary hook dependency) was removed from `FarmsScreen`, `FieldMapView`, `FarmDetailsScreen`, `AuthHeaderStyle` and `FarmSelectorSheet` with no behaviour change. The warnings are `no-bitwise` and `react-native/no-inline-styles` |
| Android build | **PASS** after this pass -- `assembleDebug -PreactNativeArchitectures=arm64-v8a` (3m 3s, `app-debug.apk` 84 MB), installed on the phone over the previous build with data kept. Previous pass: all-ABI `assembleRelease` PASS; release not rebuilt in this pass |
| Android emulator | **Smoke only** -- no authenticated E2E (no credentials) |
| Physical Android | **Phases A-F run on the Redmi, 2026-09-14: all PASS** -- migration to v6 on the real data, package READY in about 2.6 s (31 questions), offline relaunch signed in with no "Network Error", a never-opened category and its questions readable offline, an offline edit survived kill + relaunch and synced on reconnect. Not verified on the device: the offline review screen (see "Device validation"). **Also found on the phone and fixed:** reopening the app after Android killed it in the background crashed (react-native-screens restore); fixed in `MainActivity.kt` and verified on the phone -- no crash, screen renders (see "App restore after Android killed it") |
| iOS | **NOT COMPLETED** -- Mac/Xcode environment unavailable |
| Backend idempotency | **NEEDS BACKEND CHANGE** -- farm, field, monitoring create and document upload are not replay-safe |
| Schema version | **6** (19 tables; v6 adds `assessment_packages`). The v5 -> v6 migration was run against a **copy of the phone's real database** (under Jest's SQLite): every row count unchanged (1 user, 3 farms, 4 fields, 4 assessments, 6 categories, 7 snapshots), `assessment_packages` created empty. The copy was deleted afterwards |
| Dependencies added | `@op-engineering/op-sqlite@18.1.4`, `@react-native-community/netinfo@12.0.1` |


## Last Known Good Data

### The reported bug

After the app was killed and reopened with no connection, screens that had shown data a
moment earlier showed **"Network Error"** instead.

### The exact cause (audited, not assumed)

1. **Redux starts empty after a kill.** Only a handful of slices are persisted by
   redux-persist (profile, dashboard farm selection, FAQs, boundary drafts, onboarding,
   assessment resume points). Every other screen repopulates by dispatching its thunk, so on
   a cold offline start each screen depends entirely on that thunk having a durable fallback.
   While the app stays open the old data is still in memory, which is why the problem only
   appeared after a kill.
2. **Several reads had no durable fallback at all:** assessment history, assessment review
   (farmer and assessor), regen index, pull-to-refresh of the assessment summary,
   notifications and the unread count, and the monitoring modules/documents lists.
3. **The assessment question cache was effectively empty.** Categories and questions were
   only cached when each category or question was opened online. Read-only inspection of the
   physical phone's database found 4 assessments and 6 categories but **0 questions and
   0 answers**, while the server reported 26 of 31 questions answered on one of those
   assessments. Opening any category offline therefore failed.
4. **The on-screen text was axios's own message.** `services/http.ts` copies
   `getApiMessage(error)` into `error.message`; for a response-less error that is axios's
   literal `"Network Error"`. `handleApiError` then preferred that string over the
   `NETWORK_ERROR` copy in `config/errorMessages.ts`, and every screen renders
   `action.payload.message`.
5. **Startup waited on `/auth/me`.** `bootstrapThunk` awaited the request (with the HTTP
   client's two retries) before signing in from the saved session, so an offline or slow
   start sat on the splash screen first.

### The rule now

- Anything read successfully online is stored in SQLite, scoped to the signed-in user, and
  served when the same read later fails **with no response**.
- A request that got a response (401, 404, 422, 500 …) is never masked by the cache.
- A timeout is described as a slow server, not as being offline.
- With nothing cached, the screen says *"This part of the app needs a connection. Anything
  you have already saved stays on this device …"* instead of "Network Error".
- A server read never overwrites local work that has not been sent.
- Redux stays UI state; SQLite is the durable store; the Keychain holds tokens; media
  binaries stay on the filesystem.

### What is persisted, and where

| Data | Store | Written | Served offline |
|---|---|---|---|
| Session token / refresh token | Keychain | login | yes (never moved to SQLite) |
| Profile (signed-in user) | redux-persist `user.profile` | profile fetch | yes -- used to sign in on a cold start |
| Dashboard farms, per-farm dashboard | `dashboard_snapshots` | every online read | yes |
| Farm list, field list, farm detail | `farms`, `fields` | every online read | yes |
| Field overview / activity / soil / documents | `dashboard_snapshots`, `documents` | every online read | yes |
| Monitoring records | `monitoring_records` | every online read | yes |
| Monitoring modules, monitoring documents | `dashboard_snapshots` (`monitoring:<field>:…`) | every online read | **yes (new)** |
| Assessment list, field summary | `assessments`, `assessment_categories` | every online read | yes |
| Assessment offline package (all categories, questions, score descriptions, answers) | `assessment_categories`, `assessment_questions`, `assessment_answers`, `assessment_packages` | when a summary is opened online | **yes (new)** |
| Assessment review (farmer and assessor) | built from a READY package | -- | **yes (new)** |
| Assessment history (first page, no search) | `dashboard_snapshots` (`assessment:history`) | online read | **yes (new)** |
| Regen index per field | `dashboard_snapshots` (`assessment:regen:<program>:<field>`) | online read | **yes (new)** |
| Notifications (first page) and unread count | `dashboard_snapshots` | online read | **yes (new)** |
| Answers saved online | `assessment_answers` (synced copy) | on save | **yes (new)** |
| Offline answers, submits, creates, edits, media | tables + `sync_queue` | on save | yes |
| Assessor field list | `dashboard_snapshots` | online read | yes |
| FAQs | redux-persist | online read | yes |

Still online-only by design: enrolment (available programs, enrollable fields), visit
tracking, the assessor's farmer-assessment and comparison views, profile edits,
notification actions (mark read, delete), and the contact form.

### Startup no longer waits for `/auth/me`

- With a stored token **and** a saved profile, `bootstrapThunk` signs in immediately from the
  saved profile and starts `revalidateSessionThunk` in the background.
- Revalidation success updates the user; a user refreshed before bootstrap finished is kept.
- A network failure keeps the session **and** the token -- no logout, no Keychain clear, no
  error screen.
- A 401 still goes through the existing refresh-then-logout path in the HTTP client; a 404
  (account gone) signs out; any other server error keeps the session.
- A saved profile always belongs to the token's user: `userSlice` clears the profile when a
  different user signs in, and logout clears both.
- Without a saved profile the old path is unchanged, except an offline failure no longer
  clears the token.

### Tests

| Required test | Where |
|---|---|
| 1. Restart survival | `lastKnownGood.test.ts` (history, regen index, notifications, unread count, monitoring modules after close + reopen of the database); `assessmentPackage.test.ts` (categories, questions, summary, review after restart) |
| 2. Network-error fallback | both files; the bootstrap and revalidation tests in `lastKnownGood.test.ts` |
| 3. No-cache state | `lastKnownGood.test.ts` -- uncached category and review reject with the offline explanation, never "Network Error"; a timeout reads as slow; a real server message is kept |
| 4. Assessment package | `assessmentPackage.test.ts` -- READY / PARTIAL / count mismatch / partial refresh / freshness / shared in-flight download / single transaction |
| 5. Pending answer survives restart | `assessmentPackage.test.ts` -- offline answer, restart, stale refresh, still the local answer and still queued |
| 6. Stale server response | `assessmentPackage.test.ts` -- a package response that started before a newer local save does not overwrite it |
| 7. Multiple categories without opening each | `assessmentPackage.test.ts` -- open the summary online once, restart, every category and question readable offline |

One existing test was changed on purpose: `assessmentThunkOffline.test.ts` asserted that an
answer saved online "writes nothing locally". An online save now keeps a synced local copy
(nothing queued), because otherwise that answer would read back wrong offline after a kill.


## Assessment Offline Package

### Source -- existing endpoints only

Checked read-only in `backend/src` (`assessment.routes.ts`, `assessorAssessment.routes.ts`,
`assessmentMobile.service.ts`, `assessorAssessment.service.ts`), in the Hoppscotch API
collections, and against the deployed server (unauthenticated requests return **401** for
these routes and **404** for a made-up route, so the routes exist there):

| Need | Endpoint |
|---|---|
| Categories and per-category totals | `GET /assessments/my/programs/{p}/fields/{f}/summary` (assessor: `/assessor/programs/{p}/fields/{f}/summary`) |
| Every question in a category with code, text, guidance, all four score descriptions **and** the saved answer | `GET /assessments/my/programs/{p}/fields/{f}/categories/{c}/questions` (assessor: `/assessor/programs/{p}/fields/{f}/categories/{c}/questions`) |

The review endpoint returns every category in one call but without guidance or score
descriptions, so it cannot build a package on its own. No endpoint was invented; the only
client addition is the farmer `categoryQuestionsFull` path constant (the assessor one already
existed).

### When it is prepared

- When an assessment summary is opened online (farmer or assessor), in the background, not
  blocking the screen. Nothing is fetched at app startup.
- Skipped while a READY package is less than 10 minutes old; pull-to-refresh forces it.
- One download per assessment at a time -- concurrent requests share it.
- Categories are fetched three at a time.

### How it is stored

- **One transaction** per package: categories, questions, merged answers and the package
  row. A 12-category, 120-question package is written in a single transaction in the test suite.
- Questions no longer returned by the server for a fetched category are removed.
- Score descriptions are written with `COALESCE`, so opening a category's question **list**
  later (which carries no score descriptions) can no longer erase them.
- Migration **v6** adds `assessment_packages` (owner, assessment, status, counts,
  `prepared_at`), owner-scoped with cascading deletes; covered by the owner-isolation test.

### Completeness

| Status | Meaning |
|---|---|
| `READY` | Every category in the summary is stored with exactly the number of questions the summary promised, and this download fetched every category. A later refresh that partly fails keeps `READY` (the stored data is still complete) and keeps the older `prepared_at` |
| `PARTIAL` | A category could not be downloaded, or returned a different number of questions than the summary |
| `MISSING` | Never prepared for this user, assessment and role |

The offline review is served **only** from a READY package, so a user is never shown a
review that silently omits questions.

### Local work always wins

- An answer with `sync_state` other than `synced` is never overwritten by the package.
- An answer changed locally **after** the package request started is not overwritten either,
  even if it has since synced -- the older server response is discarded for that answer.
- An answer saved online is mirrored into SQLite immediately.
- After an online save, an offline save, and after a package is written, the assessment's
  answered count, percentage and status are recomputed from the stored answers -- but never
  below the count already stored, because the local answers can be a subset of the server's
  while a package is not READY (server 26 answered, device 1 row must not become 1). Found by
  the ECC `code-reviewer` agent: before this, an online save left the offline summary header
  one answer behind. Covered by three tests in `assessmentPackage.test.ts`.
- Server progress (answered, percentage, status) is applied to the local assessment unless
  there are unsent local answers. Previously any local answer blocked it, which would have
  frozen progress once packages started writing server answers.
- Farmer and assessor packages for the same field are separate.

### Performance

- **On the phone** (2026-09-14, Redmi, debug build with JS from Metro): a 6-category,
  31-question package went from the summary response to READY in **about 2.6 s**, including
  the six downloads (three at a time) and the single transaction. A release build should not
  be slower.
- In Jest (Node SQLite): a 120-question package, including all writes, completes well inside
  the 10 s assertion.


## Device validation

Run on 2026-09-14 on the physical Redmi (Android, signed in with the owner's real farmer
account), debug build of this pass installed over the previous one (data kept), JS served by
Metro over USB (`adb reverse`), so the JS kept loading while the radios were off. Evidence
came from UI element dumps, screenshots, the app's own log lines, and read-only copies of
the app database. The copies and screenshots were deleted afterwards.

| Phase | What was done | Result |
|---|---|---|
| A. Online preparation | Launched the app. The saved access token had expired: `/auth/me` and five other calls returned 401, the token refreshed, and every call then returned 200 -- no logout. Opened the assessment list and one In Progress assessment (6 of 31 answered) | **PASS.** Summary 200 at 17:05:08.9, six category downloads (three at a time), `package_prepared READY count 31` at 17:05:11.5 -- **about 2.6 s on the phone**. Database afterwards: schema **6**; package **READY**, 6 categories, **31 questions**, 6 answers, 0 failed; all 31 questions carry all four score descriptions. Before this pass the phone held **0** questions |
| B. Kill | `am force-stop` | **PASS** |
| C. Offline | Airplane mode on; confirmed no active network and the API unreachable from the phone | **PASS** |
| D. Relaunch offline | Started the app with no connection | **PASS.** Opened signed in on Home -- no login screen. `/auth/me` failed with a network error and the session was kept. Dashboard from cache with "These figures were last updated 4 hours ago …". Assessment list and summary from cache (6/31, all six category counts). Opened a category that had **never been opened** on the phone (5 questions listed) and one of its questions: text, guidance and all four score descriptions shown. "Network Error" and "needs a connection" appeared **0** times on those screens |
| E. Offline edit | Re-saved an already-answered question with its **existing** score (no change to the real data) | **PASS.** `queued_offline`; banner "1 change saved on this device"; queue 1 pending, the answer `local`. Killed and relaunched offline: still signed in, queue entry still pending, answer still `local` |
| F. Reconnect | Airplane mode off | **PASS.** `request_started` 17:15:23, `request_succeeded` 17:15:27, `flush_completed` count 1, drained. After the phone came back on USB, its database showed the queue entry `completed` with 0 retries, every answer `synced`, and the package still READY |

Not verified on the device:
- **The offline review screen.** On this assessment it is only reachable after answering the
  remaining 25 questions, and the only other action is the destructive "Discard Assessment".
  Neither is acceptable on a real account, so the review remains covered by automated tests only.
- Assessor role, and an assessment that has never been opened online (expected to show the
  offline message, covered by tests).


## App restore after Android killed it -- crash found and fixed (2026-09-14)

Found on the phone after the offline run, not by tests. When Android killed iiGrain in the
background to free memory (exit reason `LOW_MEMORY`, 17:25) and the app was reopened, it
**crashed on start** (`APP CRASH`, 17:35). The phone's crash log held the same crash twice
earlier that day (14:43 and 15:41).

**Cause.** `MainActivity.onCreate` passed `savedInstanceState` to `super.onCreate`. On a restore
Android re-creates the react-native-screens fragments, which the library forbids:
`IllegalStateException: Screen fragments should never be restored` (react-native-screens
4.26.2, thrown at `MainActivity.kt:32`). This is the "killed and reopened" path the offline work
is about, and Jest cannot reach it.

**Fix.** `super.onCreate(null)` in `MainActivity.kt`, the configuration react-native-screens
requires; `installSplashScreen()` still runs first. Nothing is lost: navigation restarts at the
root, and user data lives in SQLite, redux-persist and the Keychain rather than Android's saved
instance state. `MainActivity` is the only Activity in the app.

**Proof on the phone.** A debug build allows `run-as com.iigrain kill -9 <pid>`, which kills the
process the way the low-memory killer does and keeps the task for restore. (`am kill` did not
kill the process on MIUI; `am force-stop` clears the task, so it never reproduces.)

| After HOME, kill the process, reopen | Result |
|---|---|
| Before the fix | **Crashed** 2 s after reopening (17:43:09, `Screen fragments should never be restored`) |
| After the fix | **No crash**: no new exit record and no crash-log entry for 90 s; the process stayed alive with iiGrain in front |

In that after-fix cycle (17:49) the screen stayed white: the Metro dev server feeding the debug
build had stalled. That is a dev-server problem, not the app, and a release build does not use
Metro. Rendering was confirmed afterwards with a fresh Metro cache:

| Cycle (fixed build) | What Android reported on reopen | Result |
|---|---|---|
| 18:18 -- HOME, kill, reopen | normal activity start | Assessment screen back in 18 s; no crash record, no crash-log entry |
| 18:19 -- HOME, kill, reopen (task still in Recents) | normal activity start | Assessment screen back in 19 s; no crash record, no crash-log entry |

So the crash-free **restore** proof is the 17:49 cycle, where Android brought the old task
forward: before the fix that exact path crashed within 2 s, after it the app stayed up. The
**render** proof is the 18:18 and 18:19 cycles. The 18-19 s is the debug build reloading JS
from Metro, not a release-build figure.


## Final validation -- 2026-09-14

Validation only; no features added. One genuine bug was found and fixed:

**Submit replay was reported as a permanent failure.** When a submit reached the server but
its response was lost (app killed, connection dropped), the queued retry received
`409 Conflict` ("already been submitted") from both the farmer and assessor submit
endpoints. `classifyFailure` treats a 409 as permanent, so the entry was marked failed: the
banner said the change did not sync, **Try again** hit 409 again forever, and the assessment
kept `submit_pending = 1`. The server was right and the app misread it. Fixed in
`assessmentSubmitAdapter`: a 409 on the submit POST clears the pending flag and completes the
entry; every other error is re-thrown unchanged. Regression tests: a 409 replay completes and
clears the flag; a 400 for another reason still fails.

Also fixed: 2 ESLint errors introduced by the op-sqlite mock (`Atomics`, `SharedArrayBuffer`
globals), with a `/* global */` directive. Comment only; full suite re-run clean.

What was validated where:

| Check | Automated tests | Emulator | Physical device |
|---|---|---|---|
| SQLite init, WAL, FK, migrations to v5 | PASS | PASS (fresh install) | PASS (fresh install earlier; upgrade v3->v4->v5 earlier) |
| Migration to v6 | PASS | not tested | PASS (2026-09-14, the phone's own data) |
| Session survives offline cold start | PASS | not tested | PASS (2026-09-10 and 2026-09-14, twice) |
| Cold start signs in without waiting for `/auth/me` | PASS | not tested | PASS (2026-09-14; also an expired token refreshed with no logout) |
| Cached reads (farms, fields, details, assessments, monitoring, soil, boundaries, dashboard) | PASS | not tested | dashboard, assessment list and summary PASS offline (2026-09-14); others not exercised |
| Last-known-good reads after a restart (history, regen, notifications, monitoring lists) | PASS | not tested | not exercised |
| Assessment offline package (all categories without opening each) | PASS | not tested | PASS (2026-09-14: READY in about 2.6 s, a never-opened category and question read offline); offline review not reachable without changing real data |
| Offline writes, kill + relaunch persistence | PASS | not tested | PASS (2026-09-14: one answer, kill + offline relaunch, still pending) |
| Sync on reconnect, dependencies, server ids persisted | PASS | not tested | sync on reconnect PASS (2026-09-14: completed, 0 retries); dependencies not exercised |
| Retry / backoff, permanent errors stop | PASS | not tested | not tested |
| No duplicate queue entries, verify-before-retry | PASS | not tested | not tested |

Why device E2E stopped: authenticated flows need a signed-in session. On the emulator there
were no credentials (none were guessed and no accounts were created on the live server). On
the physical device a session existed, but the phone was in active use, so UI automation was
not attempted rather than risk acting inside the owner's accounts.

---

## What works offline today

### Foundation
- SQLite via op-sqlite, WAL verified, foreign keys enforced, `PRAGMA user_version` migration runner (forward-only, transactional, contiguity-checked).
- 19 tables. Local `local_id` + nullable `server_id` on every offline-creatable entity.
- Owner-scoped repository layer — every generated statement carries `owner_user_id = ?`.
- Database initialisation retries on app foreground (covers iOS launch-while-locked).

### Sync infrastructure
- Durable `sync_queue` (16 columns) with dependency ordering, claiming, single-flight flush.
- Retry with capped exponential backoff + jitter; transient vs permanent classification.
- Stale `in_flight` recovery (5-minute threshold), owner-scoped.
- Auth-safe sync HTTP client — a sync 401 **never** triggers global logout.
- NetInfo connectivity, event-driven (no polling).
- Owner session: local `users` row + `app_meta.active_user_id`.

Every domain with an adapter is now reachable from its screen — creating, editing and
reading all fall back to the local path when the connection is gone.

### Domains with a real adapter

| Domain | Create | Update | Delete | Duplicate protection |
|---|---|---|---|---|
| Assessment answers | — | ✅ | — | server upsert |
| Farms | ✅ | ✅ | ✅ | verify-before-retry |
| Fields | ✅ | ✅ | ✅ | verify-before-retry |
| Field boundaries | ✅ | ✅ | ✅ | idempotent `PUT` |
| Field soil | ✅ | ✅ | — | idempotent `PUT` |
| Monitoring records | ✅ | ✅ | ✅ | verify-before-retry |
| Media | ✅ | — | — | `upload_status` guard |

### Dependency chains
A whole day of offline work sequences itself correctly:

```
farm (create) → field (create) → monitoring record (create) → photo (upload)
```

Each queue entry carries `depends_on_id` pointing at the create it waits on. Nothing is
sent until its parent has a real `server_id`, and request bodies are rebuilt from the
current row at flush time (reference, not snapshot) — so the field POST goes to
`/farms/<real id>/fields`, never to a local id. Proven end-to-end in
`__tests__/offlineChain.test.ts`, including that no local id ever reaches the network.

### Media durability (was the biggest gap)
The monitoring attachment queue used to live in React state — an app kill lost the files.
It is now a durable outbox:

1. On pick, the file is **copied out of the picker cache** into
   `<DocumentDirectoryPath>/iiGrain/outbox/<owner>/<local_id>.<ext>`, and a `media_files`
   row plus its context is written — file copy, metadata and queue entry in one transaction.
2. While the record is unsaved the media is a **draft** (`attached_to_type = 'draft'`),
   listed in the form after a restart, and not yet queued.
3. On save it is **committed**: re-pointed at the record and queued, with a dependency on
   the record's own create when that record is itself offline.
4. Uploads run through the sync engine. A missing file is surfaced as failed, never silently dropped.
5. Abandoned drafts (never saved, older than 7 days, with no queue entry) are purged at startup.
   Anything queued for upload is never purged.

Binaries stay on the filesystem; SQLite holds only metadata and the path.

### Assessment (complete user flow)
- Offline answer save → SQLite + queue in one transaction.
- Offline read of assessment list, field summary, every category, every question (with score
  descriptions) and the review, once the summary has been opened online -- see
  "Assessment Offline Package".
- Server progress is applied unless unsent local answers exist, so local work is never
  undone by a server read.
- Pending local answers are never overwritten by a server read.

### Logout safety
- Signing out with unsent work now warns first, saying plainly that the work stays on the
  device and will be sent on the next signed-in session with a connection.
- Wired into the drawer, the assessor menu and the profile screen.
- Logout clears `app_meta.active_user_id` and nothing else — every row and queue entry
  survives, and signing back in as the same user resumes them. The next user sees none of it.
- Proven in `__tests__/logoutSafety.test.ts`.

### Sync status UI
`SyncStatusBanner` is a floating card above the tab bar (it used to cover it), animated in
and out, with four distinct states:

| State | Says | Action |
|---|---|---|
| Offline | "You are offline" + how many changes are held | — |
| Syncing | "Syncing your work" + how many are left | spinner |
| Failed | "N changes did not sync — nothing was lost" | **Try again** |
| Synced | "All changes synced" | auto-hides after 2.6 s |

The synced state closes the loop: previously the banner just vanished, leaving the user
unsure whether their work had landed. Retry resets failed entries to pending with a fresh
attempt count and flushes. The visit-tracking FAB lifts out of the way while the banner is up.

### Offline reads for farms and fields
Farm and field lists used to be blank offline. They now cache on every successful read and
serve from SQLite when the network is gone — including search and paging. A server read
never overwrites a row the user edited locally.

### Monitoring endpoints verified against the server, not the spec

`MOBILE-FIELD-MONITORING.md` (committed 2026-08-20) describes monitoring as
**program-scoped**: every call under `/field-monitoring/programs/{programId}/fields/{fieldId}`,
and "the same field in two programs keeps two separate sets of records". Both are out of date.

Checked read-only against `backend/src/routes/fieldModule.routes.ts`, changed after the spec
(2026-08-22, 2026-09-08): every monitoring route is **field-scoped**
(`/fields/:fieldId/modules/:module`, `/fields/:fieldId/documents/upload`, ...), the route file
states "a record belongs to a field and nothing else", and the monitoring service never reads
a `programId`. The app's endpoints were updated to match on 2026-08-22.

Consequences for offline:
- The monitoring and media sync adapters post to the correct URLs. No change.
- The monitoring cache keys records by field and module with no program. That matches the
  server's data model, so there is no risk of merging two programs' records.
- Assessors are deliberately excluded from recording on the server, which is why the
  monitoring adapter carries no role logic.

Do not change the monitoring URLs to match the spec document.

### Monitoring records offline
Filling in a monitoring form offline used to error — which was inconsistent, since the
photos attached to that form were already durable. The record now saves locally, appears
in the module list immediately, and syncs later. Reads, creates and edits all fall back.
The modules list and the documents list are now snapshotted too.

Repeated offline edits of the same record collapse into one queued change, and a later
server read never overwrites an edit the user made locally.

Attachments picked for a record that was **itself** created offline now carry
`recordLocalId`/`fieldLocalId` rather than a local id masquerading as a server id, and the
upload depends on the record's create. Without this the photo would have been POSTed to
`/field-monitoring/fields/<local uuid>/documents`.

### Soil and boundaries offline
Soil readings save locally and queue when there is no connection; repeated edits collapse
into one change and a server read never overwrites a local edit. A locked record stays
locked offline. Reads fall back to the cached record.

Boundary drawing already wrote to a local store before the network call, so the drawing
was never lost — but it threw and never retried. A failed save now queues durably through
the sync engine and the boundary is reported as `pending` rather than as an error. Clearing
a boundary offline queues the removal the same way.

### Dashboard offline
The home dashboard — the farmer's first screen — was blank offline. Both steps of the
dashboard API now snapshot to SQLite and serve from it when the connection is gone: the
farm picker and the per-farm dashboard (keyed by farm and year).

**The status doc previously claimed a `dashboard_snapshots` table already existed. It did
not.** Added in migration **v5**, with a composite key of owner + scope + year so each
farm-year keeps its own snapshot.

A cached dashboard is never presented as if it were live. The thunk reports whether it came
from cache, and `StaleDataNote` says so in plain words — "These figures were last updated
25 minutes ago. They will refresh when you are back online." Ages read as *just now*,
*an hour ago*, *yesterday*, *4 days ago*; a clock skew never renders a negative age and an
unreadable timestamp degrades to "earlier".

### Field details offline
The whole Field Details screen now survives a lost connection. Documents cache into the
existing `documents` table — name, kind, size and **url**, so a file already downloaded to
the device can still be opened. Overview, activity and soil reuse the snapshot table under
`field:<id>:<part>` scopes (through the shared `throughOfflineSnapshot` helper). Each field
keeps its own snapshot; a field never opened online still fails rather than rendering blank.

### Submitting an assessment offline
This was the most consequential gap left: a farmer finishes an assessment standing in a
field with no signal, taps **Submit**, and it failed. The `assessments` table already had a
`submit_pending` column and the repository already had a `markSubmitPending` helper — both
written earlier and never wired to anything.

Submit now falls back to the local path: the assessment is flagged pending, a durable
`assessment_submit` entry is queued, and the UI is told the submission was accepted. The
adapter posts to the real submit endpoint once back online, then clears the flag and records
`submitted_at`.

Three properties worth naming:
- The backend's submit is an upsert on (field, role, program), so **replay is safe** — no
  duplicate-protection dance needed here, unlike farm/field creates.
- If the assessment's field is itself unsynced, the submit **waits** rather than posting a
  local uuid into the URL.
- Submitting twice offline queues once, not twice.

### Help works offline -- without an extra cache

The Help screen's FAQs were already available offline before this work began. The support
slice is persisted by redux-persist (`faqs`, `faqsLoaded`, `faqsFetchedAt`), a failed fetch
does not clear them, logging out does not reset them, and HelpScreen only shows its failure
card when there is an error **and** no FAQs. Anyone who has opened Help once sees their FAQs
offline, including after logging out.

An `app_meta` FAQ cache was added during this work on the assumption that Help was blank
offline. Tracing the slice, the store and the screen showed it duplicated the existing
persistence with no visible difference, so it was removed along with its tests.

The contact form is **not** queued offline. Support enquiries are a conversation; silently
holding one for hours and sending it later would be worse than saying plainly that it needs
a connection.

### Owner isolation, proven rather than asserted

Two passes. A static sweep of every SQL statement in `repositories/`, `services/sync/` and
`services/db/` found **zero** statements touching an owner-scoped table without
`owner_user_id`. (The first version of that sweep reported 17 hits — all false positives,
because the regex cut each statement at the first nested quote like `'pending'`. Worth
saying, because a sloppy audit that reports problems it invented is worse than none.)

Static analysis only proves the column is mentioned, so `__tests__/ownerIsolation.test.ts`
proves it at runtime instead. It seeds a full working set for user A across all **12**
owner-scoped tables — farm, field, boundary, soil, assessment, answer, assessment package,
monitoring record, document, media, queue entry, snapshot — then asserts user B:

- has zero rows in every table,
- reads nothing back through any repository or any of the caches,
- cannot update, soft-delete, hard-delete, or claim a `server_id` on A's rows,
- cannot cancel, retry or purge A's queue entries,

and that both users can hold a complete parallel set without collision.

### Assessors work offline too

Assessors are the users who physically visit fields, yet every one of their ten thunks was
online-only. Now wired, reusing the same role-aware infrastructure as farmers:

| Action | Offline behaviour |
|---|---|
| Save an answer | Stored under `author_role = 'assessor'`, queued, synced to `/assessor/.../answer` |
| Submit | Flagged pending, queued, synced to `/assessor/.../submit`; the UI locks immediately |
| Summary (open + pull to refresh) | Served from cache; never serves the farmer's copy of the same field; opening it online prepares the assessor's own offline package |
| Category questions, question detail | Served from the package |
| Review | Served from a READY assessor package |

The online submit result logic was moved into one shared helper so the offline path reuses
it instead of duplicating it; a test asserts the online result is unchanged.

**The field list works offline too.** It is the assessor's entry screen, so without it none
of the above was reachable from a cold offline start. The list is snapshotted on every online
read and served when offline — but not as-was: each entry takes the assessor's own offline
work into account. An assessment submitted offline shows as completed, answers saved offline
show as in progress, and counts are recomputed only when something actually changed. The
farmer's offline progress on the same field never leaks in. The dashboard says how old the
list is ("These assessments were last updated …").

**Still online-only for assessors:** the farmer-assessment view and the comparison view —
each shows another party's or server-computed data.

### Submitted offline meant "not submitted" on screen — for both roles

Testing the assessor submit exposed two bugs in the shared assessment cache:

1. **A queued submit read back as unsubmitted.** Both the summary and list readers decided
   "submitted" from `status === 'COMPLETED'` alone, but an offline submit only sets
   `submit_pending = 1`. Reopening an assessment submitted offline showed it **unlocked and
   editable**, and the list did not count it as completed. This affected farmers too; no
   farmer test covered submit-then-reopen.
2. **It stayed unsubmitted even after syncing.** `clearSubmitPending` wrote the raw server
   string `'submitted'` into a column that holds app-level statuses (`COMPLETED`, `PENDING`,
   …). The readers never matched it. The original test asserted `'submitted'`, so the test
   had locked the bug in.

Fixed with one `effectiveStatus` helper shared by both readers (a pending submit counts as
`COMPLETED`), and `clearSubmitPending` now writes `COMPLETED`. Regression tests cover the
summary while queued, the list count, reading after sync, and that an unsubmitted assessment
is not marked submitted.

### Both roles, not just farmers

This app serves farmers **and** assessors, and the assessment screens are shared with
per-role API adapters. Auditing the sync adapters for role-awareness found that the
offline submit I had just written **always posted to the farmer endpoint**
(`/assessments/my/...`). An assessor submitting offline would have synced to the wrong URL.

Fixed: the submit adapter now routes on `author_role`, matching what the answer adapter
already did. Tests assert each role's URL and that neither leaks into the other.

The remaining adapters — farm, field, boundary, soil, monitoring, media — carry no role
logic, which is correct: those endpoints are not role-scoped, and assessment evidence has a
single shared upload endpoint.

### A timeout is not the same as being offline

Adding offline fallbacks everywhere introduced a duplicate risk that had to be closed.

`handleApiError` classifies **any** response-less axios error as `offline` — and a request
that times out has no response. The client is configured with `API_TIMEOUT=15000`. So on a
slow-but-working connection a farm create could time out **after the server had already
accepted it**, the fallback would write a local row and queue a blind re-POST, and the sync
would produce a **second farm**.

The existing verify-before-retry guard did not cover this: it only runs when
`attempt_count > 0`, and an entry queued by the fallback starts at zero.

Now a create whose outcome is genuinely *unknown* is queued with `{"verifyFirst":true}`,
and the engine verifies before the first send as well as on retries. A create made with no
connection at all is **not** marked — the request never left the device, so there is nothing
to verify and no wasted round trip.

`isTimeoutError` distinguishes the two. A real JS bug stays `kind: 'unknown'` and is never
swallowed by a fallback — asserted in `__tests__/uncertainOutcome.test.ts`.

### Queue housekeeping
Inspecting the real device turned up something tests had not: `sync_queue` held six
`completed` entries from genuine use, and `purgeCompleted` — written long ago — was **never
called anywhere**. The queue would have grown without bound for the life of the install.
Startup now purges completed entries older than 7 days, owner-scoped, and never touches
anything still unsent.

### Showing what has not reached the server
Farm and field rows now expose `pendingSync`, and the cards show a small
"Not synced yet" chip. Set when the row has no `server_id` **or** has local edits that have
not been sent; cleared once the row syncs. Previously nothing on screen distinguished a
record that was safely on the server from one that only existed on the phone.

### Offline creates from the UI
Creating a farm or a field while offline no longer errors. The create falls back to the
local write path, the record appears in the list immediately, and it syncs later. A field
added to a farm that was *itself* created offline chains correctly behind it — proven in
`__tests__/offlineCreateFlow.test.ts`, which asserts the two requests go out in order with
real server ids.

### Offline session
- A cold start with a saved session signs in immediately and revalidates in the background;
  a network failure never logs out or clears the Keychain. See "Last Known Good Data".
- **Verified on the physical phone**: on 2026-09-10 an offline cold start kept the session; on
  2026-09-14 the immediate sign-in worked offline twice, and online an expired access token was
  refreshed with no logout.

---

## Backend idempotency — audited, mitigated client-side

Audited `backend/src` directly. **No** `Idempotency-Key` handling, **no** client-supplied ids, **no** unique constraints on the create endpoints.

| Endpoint | Replay-safe? | Mitigation |
|---|---|---|
| `PUT .../questions/{q}/answer` | ✅ `ON CONFLICT … DO UPDATE` | none needed |
| `POST .../submit` | YES -- unique `(field, role, program)`; replay returns `409` | client treats `409` as already submitted (fixed 2026-09-14) |
| `PUT /fields/{id}/soil` | ✅ unique index | none needed |
| `PUT .../boundary` | ✅ replaces in place | none needed |
| `POST /farms/me/farms` | ❌ | **verify-before-retry** |
| `POST /farms/{id}/fields` | ❌ | **verify-before-retry** |
| `POST .../modules/{module}` | ❌ | **verify-before-retry** (value match) |
| `POST /field-monitoring/fields/{id}/documents/upload` | NO -- plain create | **none** -- `upload_status` guard only; a lost response re-uploads the file |

**Verify-before-retry**: a `create` is never blind-retried. On any attempt after the first,
the engine calls the adapter's `verifyCreated`, which queries the server for a matching
record within a 24 h creation window — name + area for farms and fields, the record's own
values for monitoring. If found, the local row adopts that `server_id` and the entry
completes with no second POST.

**This is a mitigation, not a guarantee.** It narrows the duplicate window to a genuine
race (two records created with identical values in the same window). The real fix is a
backend change — see Backend changes required.

---

## Remaining

- **Notification actions** (mark read, delete) stay online-only; the first page and the unread
  count are now readable offline.
- **The device scenario** (see "Device validation") — needs a person with the phone.

---

## Release build validated (2026-09-11)

The release build had never been attempted. It now builds and its contents are verified.

| Check | Result |
|---|---|
| `assembleRelease` (arm64-v8a) | **BUILD SUCCESSFUL** |
| `libop-sqlite.so` packaged | ✅ present for arm64-v8a |
| `libhermesvm.so` packaged | ✅ |
| JS bundle | 7.0 MB, magic `c6 1f bc 03` → **Hermes bytecode**, not plain JS |
| Metro needed at runtime | No — bundle is embedded in the APK |
| Offline code in the shipped bundle | ✅ `dashboard_snapshots`, `assessment_submit`, `sync_queue`, `media_files` and the user-facing strings all found inside the bytecode |
| APK size | 46 MB (single ABI, minified) vs 247 MB debug |

Two build problems were hit and diagnosed; neither was product code:
1. **`react-native-worklets` CMake failure** — stale `intermediates/cxx` left behind by a
   build that had been killed mid-flight. Fixed by deleting that directory.
2. **`createBundleReleaseJsAndAssets` failing with exit 1** — a transient Metro
   *"transform cache was reset"*. The same bundle built cleanly standalone, and the gradle
   task passed on re-run. Worth knowing it can fail once and then succeed unchanged.

The earlier **x86 / x86_64 CMake failure no longer reproduces**: the default all-ABI `assembleRelease` passed on 2026-09-14 and the APK carries `libop-sqlite.so` for all four ABIs. It was stale native build state, not a code problem.

**The release APK was run** on the physical device on 2026-09-11 (launch, zero fatal lines, offline login screen with no sync banner). Not re-run after the 2026-09-14 changes.

## Verified on the device (2026-09-10)

A debug build was installed on the physical Redmi and launched against Metro:

- `libop-sqlite.so` loads on arm64-v8a under the New Architecture.
- The database on the device migrated **v3 → v4 in place**: `PRAGMA user_version` reads 4,
  `media_files` has the new `context_json` column, and `sync_queue` still carries all 16
  columns including `depends_on_id` and `claimed_at`.
- Pre-existing data survived the migration — 2 users, 1 farm, 1 field, 1 assessment,
  6 cached questions, 1 category, and the active owner in `app_meta` were all still there.
- `journal_mode` reads `wal` on the device.
- Rebuilt and reinstalled after the UI and wiring work; the app launches clean with no
  redbox and no fatal log lines.
- **The read cache demonstrably works on the device.** Before this round the local DB held
  1 farm and 1 field (rows written by hand during earlier testing). After launching the
  rebuilt app against the live server it holds **2 farms and 3 fields** — the real account's
  data, written by `cacheFarmList`/`cacheFieldList` on a normal online read. `sync_queue` is
  empty, which is correct for an online device with nothing pending.
- **The banner itself has still not been seen on screen** — the device is PIN-locked, so
  visual confirmation needs a person to unlock it and pull the network.

(To re-check: `adb exec-out "run-as com.iigrain cat /data/data/com.iigrain/databases/iigrain.sqlite"` —
`adb shell` mangles the binary on Windows, `exec-out` does not.)

---

## Known limitations

1. **Duplicate creates are mitigated, not eliminated.** See the table above.
2. **iOS is unvalidated.** Static audit found no blocker and the `use_frameworks!` fix is in the Podfile, but nothing has been built or run on macOS.
3. **No background sync** — by design. Both platforms make it unreliable; sync runs while the app is active.
4. **The intermittent test failure is identified and fixed.** It was `App.test.tsx ›
   renders correctly` exceeding Jest's default **5000 ms** timeout — not SQLite file
   locking, which had been the standing (and explicitly unproven) suspicion. That test
   mounts the entire app tree — navigation, drawer, every provider, database init — and
   under parallel CPU load the file took **88 s** on the run that failed. Caught by looping
   the suite while saving each run's full output, which is what the earlier attempts had
   failed to do. Given a 60 s timeout, since a whole-app smoke test is not a 5 s operation.
   Four consecutive clean full-suite runs since.
5. **Assessment evidence** requires upload before the answer can carry URLs, so offline photos on answers are not yet supported.
6. **Uploads have no duplicate protection.** The backend creates a new document row per upload and the media adapter has no verify step, so an upload whose response is lost is sent again and duplicated.
7. **Device E2E partly done.** On 2026-09-14 the phone passed: offline cold start, the assessment package, an offline answer surviving kill + relaunch, and sync on reconnect. Still proven by automated tests only: the offline review screen, retry/backoff, dependency chains, duplicate protection, the assessor role, and iOS.
8. **Release signing.** `release` still uses `signingConfigs.debug`; a real upload keystore is needed before store release (not offline-related).
9. **An assessment must be opened online once** for its package to exist. Assessments never opened online are not downloaded in advance, by design (nothing is bulk-fetched at startup).
10. **Snapshots are the first page only** for history and notifications; a search or a later page still needs a connection.

---

## Backend changes required (not made — backend is out of scope)

1. **Accept a client-supplied UUID** on `POST /farms/me/farms`, `POST /farms/{id}/fields`, and `POST .../modules/{module}`, with `ON CONFLICT (id) DO NOTHING RETURNING`. This eliminates duplicates entirely **and** removes the local-id→server-id resolution chain. Highest value by far.
2. Failing that, an `Idempotency-Key` header with stored request/response pairs.
3. A `version` column + `If-Match`/409 on mutable entities, so conflicts can be detected rather than silently last-write-wins.

---

## Production blockers

| Blocker | Type | Owner |
|---|---|---|
| No idempotency on farm, field and monitoring create, and on document upload -- lost responses can create duplicates (mitigated heuristically for creates, not at all for uploads) | Backend change: accept a client-supplied UUID with `ON CONFLICT DO NOTHING`, or an `Idempotency-Key` | Backend |
| iOS never built or run | Environment | Needs Mac + Xcode |
| Remaining device QA: offline review screen, retry/backoff, dependency chains, assessor role (kill/relaunch, package and sync passed on the phone on 2026-09-14) | Human QA | Tester with a signed-in device and a disposable test assessment |
| Release build signed with the debug keystore | Release config (not offline) | App owner |
