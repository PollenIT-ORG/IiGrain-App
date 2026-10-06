# 05 — Farmer Offline Flow (step by step)

Each step answers the twelve questions from the brief. "Today" = current code.
"Proposed" = the target design, not implemented.

---

## Step 0 — Cold start with no connectivity

| Question | Answer |
|---|---|
| Data required | Keychain tokens + cached `AuthUser` |
| Where it comes from today | `GET /auth/me` on every launch |
| API-driven? | Yes |
| Persisted locally today? | Tokens yes (Keychain). User object **no** |
| Requires internet today? | **Yes — and failure logs the user out** |
| Works with SQLite? | Yes: `users` row + a "trust the cached identity" bootstrap path |
| GPS / tiles / server ids | no / no / no |
| Can the user do this offline? | Not today. After the fix, yes |
| On sync | Re-validate with `/auth/me`; if it returns 401 *with a response*, then log out |

**The single most important change in the whole project.** `bootstrapThunk`
(`src/redux/slices/authSlice.ts:53`) must distinguish `kind === 'offline'`
(no response — keep the session, mark it unverified) from a real 401 (clear
tokens). `handleApiError` already produces that distinction; nothing uses it.

---

## Step 1 — Home / dashboard

| Question | Answer |
|---|---|
| Data required | `GET /dashboard/my/farms`, then `GET /dashboard/my/farms/{farmId}` |
| Persisted today? | Only `selectedFarmId` |
| Requires internet | Yes — screen is blank offline |
| SQLite | Yes — `dashboard_snapshots`, cached verbatim |
| GPS / tiles | no / no |
| Server ids | Yes — `farmId` must be a server id, so a locally-created farm has no dashboard |
| Offline create | n/a (read-only surface) |
| On sync | Re-pull; clear `stale` |

**Limitation to state in the UI:** RHI and score cards are computed server-side.
Answering questions offline will *not* move them until sync. Show the snapshot
with an "as of <time>" stamp rather than a number that silently lies.

---

## Step 2 — Farms list & detail

Pure reads (`GET /farms/me/farms`, `GET /farms/me/farms/{id}`), paged
(20/page, server-side `search`). **FULLY OFFLINE** once cached.

Two behaviours to decide (`REQUIRES PRODUCT DECISION`):

* Offline, do we show only page 1 (what was cached), or everything ever cached
  merged? Recommendation: everything cached, sorted locally, with a banner.
* Server-side `search` cannot run offline. Recommendation: fall back to a local
  `LIKE` query over the cache and label it "searching downloaded farms only".

---

## Step 3 — Create farm  ← the flagship offline write

Verified inputs from `screens/farms/AddFarmScreen.tsx` and `api/FarmApi.ts`:

| Field | Required | Source | Offline? |
|---|---|---|---|
| `name` | **yes** (validator, min 2 chars) | user typing | ✅ |
| `areaAcres` | **yes** (`requiredPositiveNumberValidator`) | user typing | ✅ |
| `businessEntity` | no | user typing | ✅ |
| `location` (address string) | no | `LocationPickerModal` → reverse geocode | ⚠️ needs network for the *text*, not the pin |
| `latitude` / `longitude` | no (but the picker supplies them) | device GPS | ✅ |

**No field on this form comes from an API.** There is no dropdown, no server-side
lookup, no validation round-trip. That is what makes offline farm creation
genuinely feasible.

| Question | Answer |
|---|---|
| Requires a server id? | The **response** carries one; the request does not need one |
| Can a local UUID be used? | Yes — `farms.local_id`, with `server_id` NULL until sync |
| Child dependencies | Yes: fields, and everything under them |
| If sync has not happened | The farm is fully usable locally: shown in lists, openable, editable, and fields can be added under it — but it cannot appear on the dashboard, cannot be enrolled in a program, and cannot be assessed, because all three need a server id |
| On sync | `POST /farms/me/farms` → take `data.farm.id` → write `server_id`, flip `sync_status` to `synced`, then release any queued children (`10`) |

**Risk:** the server generates the UUID and there is no unique constraint on
`(owner_id, name)` — a lost response on retry creates a duplicate farm (`10`).

---

## Step 4 — Farm location

Fully covered in `08`. Short version: the **pin** works offline (GPS is a sensor),
the **map underneath it** does not (Google tiles), and the **address string** does
not (Nominatim). Store `latitude`/`longitude` immediately, resolve `location` text
later and mark the row `address_resolved = 0` in the meantime.

---

## Step 5 — Create field

Inputs from `screens/farms/AddFieldScreen.tsx`: `name`, `areaAcres`, `crop`,
`season`, `irrigation`, `location`, `sowingDate`, `expectedHarvest`, `coords`,
`boundaryRing`, plus an optional soil sub-form. Two hard client-side gates:
`locationMissing` (no coords) and `boundaryMissing` (< 3 boundary points).

Again: **no input comes from an API.** Crop/season/irrigation are free text or
client-side lists.

| Question | Answer |
|---|---|
| Farm dependency | **Hard.** The create URL is `POST /farms/{farmId}/fields` — a *server* farm id |
| Server id needed | Yes, for the parent farm |
| Local id strategy | `fields.local_id`; parent referenced by `farm_local_id`, resolved to `server_id` at flush time |
| Location | GPS, offline ✅ |
| Boundary | Fully local ✅ (see `08`) |
| Can the farmer create a field offline? | **Yes**, including under a farm that is itself still local — the queue just has to flush the farm first |
| On sync | Farm CREATE → field CREATE (boundary inlined in the same POST) → optional soil PUT |

**Recommendation:** send the boundary inline in the field CREATE (`CreateFieldInput.boundary`
already supports it, and `AddFieldScreen` already does this online). That turns
what could be two queued operations into one, and removes a failure window where a
field exists without its boundary.

---

## Step 6 — Field detail, soil, documents

* Overview / activity / soil / documents all come from `GET /fields/{id}/details`
  → cacheable, **FULLY OFFLINE** for reading.
* Soil edit → `PUT /fields/{id}/soil`, shape-idempotent, **PARTIALLY OFFLINE**.
* Document upload → multipart, **PARTIALLY OFFLINE**, needs the media outbox (`11`).
* Document download → already writes to app-scoped storage via
  `services/fileDownloadService.ts` (`RNFS.DocumentDirectoryPath` on iOS,
  `ExternalDirectoryPath` on Android). Already-downloaded documents open offline
  today. That is the one offline capability the app already has.

---

## Step 7 — Enrolment

`GET /programs/my/available` and `GET /programs/my/fields` cache fine.
`POST /programs/{id}/enroll-self` should stay **ONLINE REQUIRED**: `AvailableProgram`
carries `userLimit`, `enrolledCount`, `isFull`, `canEnroll`. A queued enrolment can
be refused on sync after the farmer has been told they are enrolled, and the
downstream damage is large — assessments are program-scoped, so a failed enrolment
invalidates every answer captured under it.

`REQUIRES PRODUCT DECISION`: is "enrolllater, we will confirm when you are back
online" acceptable copy? If yes, the enrolment can be queued as a *request* with an
explicitly pending state in the UI. If no, keep it online-only.

---

## Step 8 — Assessment

Full design in `07`. Summary: **the most offline-capable write in the app**, because
`PUT …/answer` is a true server-side upsert and the question template can be
prefetched in one call per category.

---

## Step 9 — Monitoring (nine modules)

* Form definitions are compiled into the bundle (`src/config/monitoringModules.ts`)
  — no prefetch needed, the forms render offline as-is. This is the single biggest
  free win in the app.
* Records: `POST/PATCH/DELETE` — queueable, but **no server-side unique key**, so
  CREATE carries the duplicate risk (`10`).
* Field points seeding (`seedFieldPointsThunk`) does a read-then-create-many loop.
  Offline it must become: create locally against a local point set, and reconcile on
  sync by the same `lat/lng` key the thunk already uses.
* Attachments: media outbox (`11`).

---

## Farmer dependency graph (what must sync in what order)

```
users (never created offline)
  └── farms CREATE ─────────────► server farm id
        ├── farms UPDATE/DELETE            (needs farm server id)
        └── fields CREATE ──────────► server field id
              ├── field boundary PUT       (or inlined in the CREATE)
              ├── field soil PUT
              ├── field documents UPLOAD
              ├── monitoring records CREATE ──► server record id
              │     └── monitoring documents UPLOAD
              └── assessment answers UPDATE  ── requires enrolment (online)
                    └── assessment SUBMIT     (last)
```

Anything to the right of an arrow cannot flush until the thing to its left has a
`server_id`.

---

## What the farmer can and cannot do on a fully offline day

**Can (after the full build):**
open the app; see farms, fields, field details, cached documents, cached
assessments and history; create farms; create fields with GPS pin and drawn
boundary; edit them; capture soil data; fill any of the nine monitoring forms;
answer and re-answer every assessment question with scores and comments; resume
exactly where they left off; review their answers.

**Cannot:**
log in for the first time; see a map basemap or satellite imagery; get a street
address for a pin; enroll in a program; see an updated RHI or dashboard number;
receive notifications; start or be tracked on a visit; upload a photo (it is
captured and queued, but not uploaded); see anything another user changed.
