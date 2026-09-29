# 02 — API Audit & Offline Feasibility Matrix

Two parts: (A) every API the app actually calls, (B) the per-feature verdict.

Classification vocabulary used throughout:

| Label | Meaning |
|---|---|
| **FULLY OFFLINE** | Works end to end with no network, given a prior cache/prefetch |
| **PARTIALLY OFFLINE** | Some of the flow works; a named part needs network |
| **ONLINE REQUIRED** | Cannot work offline at all |
| **NOT CURRENTLY FEASIBLE** | Would work in principle but the current code makes it impractical |
| **REQUIRES BACKEND CHANGE** | Blocked on something only the backend can provide |
| **REQUIRES PRODUCT DECISION** | Technically possible; needs a business ruling |

---

# Part A — API audit

Source: `src/config/endpoints.ts` plus the `src/api/*.ts` callers. No endpoint below
is invented.

## A.1 Auth (`src/api/authApi.ts`)

| Endpoint | Method | Input | Output | Offline? | Notes |
|---|---|---|---|---|---|
| `/auth/login` | POST | email, password | user + token + refreshToken | ONLINE REQUIRED | First login must be online. |
| `/auth/me` | GET | — | AuthUser | **ONLINE REQUIRED today, must become optional** | Called by `bootstrapThunk`; failure clears Keychain. Blocker #1. |
| `/auth/refresh-token` | POST | refreshToken | token, refreshToken | ONLINE REQUIRED | Token rotation. |
| `/auth/register`, `/auth/request-otp`, `/auth/verify-otp`, `/auth/forgot-password`, `/auth/verify-reset-code`, `/auth/reset-password`, `/auth/enrollment-id/lookup`, `/auth/check-email` | POST | — | — | ONLINE REQUIRED | Signup/recovery are inherently online. |
| `/auth/logout` | POST | refreshToken | — | PARTIAL | Local teardown already happens before the call and the call is `try/catch`-swallowed (`authSlice.ts:logoutThunk`). |
| `/roles` | GET | — | roles | ONLINE REQUIRED | Signup only. |

## A.2 Profile

| Endpoint | Method | Input | Output | Offline? | Notes |
|---|---|---|---|---|---|
| `/profile/me` | GET | — | UserProfile | FULLY OFFLINE (cacheable) | Already persisted via `user.profile`. |
| `/profile/me` | PATCH | fullName, phone | UserProfile | PARTIALLY OFFLINE | Queueable; low value, low risk. |
| `/profile/me` | DELETE | — | — | ONLINE REQUIRED | Account deletion must not be queued. |
| `/profile/me/avatar` | POST | multipart `avatar` | UserProfile | PARTIALLY OFFLINE | Needs file queue. Low priority. |
| `/profile/me/avatar` | DELETE | — | UserProfile | PARTIALLY OFFLINE | |
| `/profile/change-password` | POST | currentPassword, newPassword | — | ONLINE REQUIRED | Never queue credentials. |
| `/profile/organization` | GET | — | Organization \| null | FULLY OFFLINE (cacheable) | |

## A.3 Farms (`src/api/FarmApi.ts`)

| Endpoint | Method | Input | Output | Required IDs | Offline? |
|---|---|---|---|---|---|
| `/farms/me/farms` | GET | `page,limit,search` | `{farms[], meta}` | — | FULLY OFFLINE (cacheable) |
| `/farms/me/farms/{farmId}` | GET | — | farm | server `farmId` | FULLY OFFLINE (cacheable) |
| `/farms/me/farms` | POST | name, businessEntity, areaAcres, location, latitude, longitude | created farm (**server UUID**) | — | PARTIALLY OFFLINE — needs local id + outbox |
| `/farms/me/farms/{farmId}` | PATCH | same fields | farm | server `farmId` | PARTIALLY OFFLINE |
| `/farms/me/farms/{farmId}` | DELETE | — | — | server `farmId` | PARTIALLY OFFLINE |
| `/farms/me/farms/{farmId}/reset` | POST | — | farm | server `farmId` | ONLINE REQUIRED (destructive, low value offline) |

Backend insert: `prisma.farms.create` (`backend/src/models/farm.model.ts:103`) — the
server generates the UUID, **no client-supplied id is accepted**, and there is **no
unique constraint** on farm name/owner. See `10` for the duplicate risk.

## A.4 Fields (`src/api/FieldApi.ts`)

| Endpoint | Method | Input | Output | Required IDs | Offline? |
|---|---|---|---|---|---|
| `/farms/{farmId}/fields` | GET | — | fields[] | server `farmId` | FULLY OFFLINE (cacheable) |
| `/farms/{farmId}/fields/{fieldId}` | GET | — | field | both | FULLY OFFLINE (cacheable) |
| `/farms/{farmId}/fields` | POST | name, areaAcres, crop, season, irrigation, location, lat, lng, sowingDate, expectedHarvest, **boundary (GeoJSON)** | field (**server UUID**) | server `farmId` | PARTIALLY OFFLINE — depends on farm having a server id |
| `/farms/{farmId}/fields/{fieldId}` | PATCH | same, all optional | field | both | PARTIALLY OFFLINE |
| `/farms/{farmId}/fields/{fieldId}` | DELETE | — | — | both | PARTIALLY OFFLINE |
| `/farms/{farmId}/fields/{fieldId}/reset` | POST | — | field | both | ONLINE REQUIRED |
| `/farms/{farmId}/fields/{fieldId}/boundary` | PUT | `{boundary: GeoJSON \| null}` | — | both | PARTIALLY OFFLINE — already local-first, see `08` |

Backend insert: `prisma.fields.create` (`backend/src/models/field.model.ts:116`) —
server UUID, no client id.

**Dependency:** field CREATE requires a **server** `farmId` in the URL path. An
offline-created farm therefore blocks its fields until the farm syncs. This is the
primary ID dependency chain (`10`).

## A.5 Dashboard (`src/api/dashboardApi.ts`)

| Endpoint | Method | Offline? | Notes |
|---|---|---|---|
| `/dashboard/my/farms` | GET | FULLY OFFLINE (cacheable) | Step 1 of the two-step dashboard. |
| `/dashboard/my/farms/{farmId}` | GET | FULLY OFFLINE (cacheable) | Step 2; RHI cards. Derived server-side — offline values will be stale after local writes. |

## A.6 Field details & soil

| Endpoint | Method | Offline? | Notes |
|---|---|---|---|
| `/fields/{fieldId}/details` | GET | FULLY OFFLINE (cacheable) | One endpoint serving overview/activity/soil/documents. |
| `/fields/{fieldId}/soil` | GET | FULLY OFFLINE (cacheable) | Called with `silent: true`. |
| `/fields/{fieldId}/soil` | PUT | PARTIALLY OFFLINE | Idempotent by shape; unique index `uq_field_soil_field_alive` exists. |
| `/fields/{fieldId}/documents` | GET | FULLY OFFLINE (metadata cacheable) | Binaries need separate handling (`11`). |
| `/fields/{fieldId}/documents` | POST | PARTIALLY OFFLINE | multipart; needs file outbox. |
| `/fields/{fieldId}/documents/{documentId}` | DELETE | PARTIALLY OFFLINE | |

## A.7 Assessment — farmer (`src/api/assessmentApi.ts`)

| Endpoint | Method | Input | Output | Offline? |
|---|---|---|---|---|
| `/assessments/my/fields` | GET | page,limit,search | overview + counts + fields[] | FULLY OFFLINE (cacheable) |
| `/assessments/my/history` | GET | page,limit,search,farmId | history | FULLY OFFLINE (cacheable) |
| `/assessments/my/programs/{p}/fields/{f}/summary` | GET | — | field + assessment + categories[] | FULLY OFFLINE (prefetchable) |
| `.../categories/{c}/questions/list` | GET | — | question stubs (`id, code, text, guidance, answered`) | FULLY OFFLINE (prefetchable) |
| `.../categories/{c}/questions/{q}` | GET | — | full detail incl. `scoreDescriptions`, saved answer | FULLY OFFLINE (prefetchable, but 1 call per question) |
| **`.../categories/{c}/questions`** (no `/list`) | GET | — | **full detail for every question in the category** | FULLY OFFLINE — **exists on the backend, not wired into the app.** See `07`/`12`. |
| `.../questions/{q}/answer` | PUT | `{score, comment?, evidenceUrls?}` | saved answer | **PARTIALLY OFFLINE — best candidate.** True upsert server-side, idempotent. |
| `.../review` | GET | — | full review with all answers | FULLY OFFLINE (prefetchable) |
| `.../submit` | POST | — | submit result | PARTIALLY OFFLINE — upsert server-side, idempotent |
| `.../discard` | DELETE | — | discarded count | PARTIALLY OFFLINE (destructive; product decision) |
| `.../regen-index` | GET | — | RHI | FULLY OFFLINE (cacheable, stale after local writes) |
| `/assessments/evidence` | POST | multipart `files[]` | `{urls[]}` | **ONLINE REQUIRED as currently designed** — see below |

**Evidence is the assessment blocker.** `SaveAnswerInput.evidenceUrls` is
`string[]` — *server* URLs. `QuestionView.tsx:230` refuses to save while
`evidenceUploading`, and the uploader (`uploadEvidenceFile`) posts the file and
returns a URL before the answer PUT can be built. So offline, a question with a
photo cannot even be composed today. Design in `07`/`11`.

## A.8 Assessment — assessor (`src/api/assessorApi.ts`)

Same shape as farmer under `/assessor/...`:
`fields`, `summary`, `categories/{c}/questions/list`, `categories/{c}/questions/{q}`,
`categories/{c}/questions` (**declared in `Endpoints` as `categoryQuestionsFull`, never called**),
`questions/{q}/answer` (PUT), `review`, `submit`, `farmer-assessment`, `comparison`.

Offline verdicts are identical to A.7, **plus** the visit gate (A.10).

## A.9 Programs / enrollment (`src/api/enrollmentApi.ts`)

| Endpoint | Method | Offline? | Notes |
|---|---|---|---|
| `/programs/my/available` | GET | FULLY OFFLINE (cacheable) | |
| `/programs/my/fields` | GET | FULLY OFFLINE (cacheable) | |
| `/programs/{programId}/enroll-self` | POST | **ONLINE REQUIRED (recommended)** | Enrolment allocates program capacity (`userLimit`, `isFull`). A queued enrolment can be rejected on sync after the farmer believed they were enrolled. Product decision. |
| `/programs/{programId}/fields/{fieldId}/unenroll` | POST | ONLINE REQUIRED (recommended) | Same reasoning. |

## A.10 Visits (`src/api/visitApi.ts`)

| Endpoint | Method | Offline? | Notes |
|---|---|---|---|
| `/visits` | POST | ONLINE REQUIRED | Starts a visit; returns the server visit id that gates assessor access. |
| `/visits/{id}/location` | POST | ONLINE REQUIRED | Live GPS streaming — pointless offline by definition. |
| `/visits/{id}/arrive`, `/end` | POST | PARTIALLY OFFLINE | Queueable, but see `06`. |
| `/visits/mine/assessor`, `/mine/farmer`, `/{id}`, `/{id}/track` | GET | FULLY OFFLINE (cacheable) | Cache is only useful for showing history. |

Visit tracking is a real-time feature. It is **out of offline scope** except for the
part that gates assessor assessment access.

## A.11 Field monitoring (`src/api/fieldMonitoringApi.ts`)

| Endpoint | Method | Offline? | Notes |
|---|---|---|---|
| `/field-monitoring/farms/{farmId}/fields` | GET | FULLY OFFLINE (cacheable) | |
| `/field-monitoring/fields/{fieldId}/modules` | GET | FULLY OFFLINE (cacheable) | Nine modules; form definitions are **client-side** in `src/config/monitoringModules.ts`, not fetched. |
| `.../modules/{module}` | GET | FULLY OFFLINE (cacheable) | |
| `.../modules/{module}` | POST | PARTIALLY OFFLINE | Server UUID; **no unique constraint** → duplicate risk on retry. |
| `.../modules/{module}/{recordId}` | GET/PATCH/DELETE | PARTIALLY OFFLINE | Needs server `recordId`. |
| `.../documents`, `.../documents/upload`, `.../documents/{id}` | GET/POST/DELETE | PARTIALLY OFFLINE | multipart; file outbox. |

**Good news:** monitoring form definitions (fields, labels, types, options,
validation) are compiled into the app (`config/monitoringModules.ts`), so the forms
themselves render offline with no prefetch at all.

## A.12 Notifications

| Endpoint | Method | Offline? |
|---|---|---|
| `/notifications`, `/unread-count` | GET | FULLY OFFLINE (cacheable, will be stale) |
| `/{id}/read`, `/read-all`, DELETE variants | POST/DELETE | PARTIALLY OFFLINE — queueable, low value |

---

# Part B — Feature matrix

`✔` = yes, `—` = not applicable to that role.

| Feature | Farmer | Assessor | Verdict | Why | Required local data | Future sync |
|---|:--:|:--:|---|---|---|---|
| Login (first time) | ✔ | ✔ | **ONLINE REQUIRED** | Credentials are verified server-side; no local password store and none should be added | — | — |
| Session restore (cold start, already logged in) | ✔ | ✔ | **FULLY OFFLINE after fix** | Today `bootstrapThunk` clears tokens when `/auth/me` fails | cached `AuthUser` + Keychain tokens | revalidate on reconnect |
| Farmer profile view | ✔ | ✔ | **FULLY OFFLINE** | Already persisted (`user.profile`) | `users` row | pull on reconnect |
| Edit profile | ✔ | ✔ | PARTIALLY OFFLINE | Queueable, but rarely needed in a field | pending patch | outbox |
| Change password / delete account | ✔ | ✔ | **ONLINE REQUIRED** | Security-sensitive; must not be queued | — | — |
| Farm list | ✔ | — | **FULLY OFFLINE** | Pure read | `farms` | pull |
| Farm detail | ✔ | — | **FULLY OFFLINE** | Pure read | `farms` | pull |
| Create farm | ✔ | — | **PARTIALLY OFFLINE** | All inputs are local; only the server UUID is missing | `farms` + `sync_queue` | CREATE, then id backfill |
| Edit / delete farm | ✔ | — | PARTIALLY OFFLINE | Needs a server id, so only for already-synced farms | `farms` | UPDATE / DELETE |
| Farm location (GPS pin) | ✔ | — | **FULLY OFFLINE** | GPS is a device sensor | lat/lng on the farm row | — |
| Farm address (reverse geocode) | ✔ | — | **ONLINE REQUIRED** | Nominatim HTTP call | resolve later | resolve on reconnect |
| Map tiles / satellite | ✔ | ✔ | **ONLINE REQUIRED** | Google tiles are fetched on demand; no offline tile store configured | — | — |
| Field list | ✔ | — | **FULLY OFFLINE** | Pure read | `fields` | pull |
| Create field | ✔ | — | **PARTIALLY OFFLINE** | Needs a **server** `farmId` in the path — blocked behind farm sync if the farm is also local | `fields` + `sync_queue` | ordered CREATE |
| Edit / delete field | ✔ | — | PARTIALLY OFFLINE | Server ids required | `fields` | UPDATE / DELETE |
| Field location | ✔ | — | **FULLY OFFLINE** | GPS | lat/lng | — |
| Boundary drawing (data) | ✔ | — | **FULLY OFFLINE** | Already local-first today: `boundarySlice` is persisted and carries a `syncStatus` | `field_boundaries` | PUT boundary |
| Boundary drawing (visual basemap) | ✔ | — | **ONLINE REQUIRED** | Tiles. Drawing still functions on a grey map — see `08` | — | — |
| Field soil record | ✔ | — | PARTIALLY OFFLINE | PUT is shape-idempotent | `field_soil` | UPDATE |
| Assessment list (mine / history) | ✔ | ✔ | **FULLY OFFLINE** | Pure read | `assessments` | pull |
| Assessment summary + categories | ✔ | ✔ | **FULLY OFFLINE (prefetch)** | Server-computed but cacheable | `assessments`, `assessment_categories` | pull |
| Assessment questions + score guidance | ✔ | ✔ | **FULLY OFFLINE (prefetch)** | Bulk endpoint exists on both sides | `assessment_questions` | pull |
| Answer a question (score + comment) | ✔ | ✔ | **FULLY OFFLINE** | PUT is a true server-side upsert → safe to replay | `assessment_answers` + `sync_queue` | UPDATE, idempotent |
| Attach evidence photo to an answer | ✔ | ✔ | **PARTIALLY OFFLINE — requires app redesign** | Today the file must upload before the answer saves | `media_files` + filesystem | upload, then re-PUT answer with URLs |
| Resume an assessment | ✔ | ✔ | **FULLY OFFLINE** | Resume pointer is already persisted; answers need SQLite | `assessment_answers` | — |
| Review screen | ✔ | ✔ | **FULLY OFFLINE (derivable locally)** | Can be computed from local answers instead of `GET /review` | local join | — |
| Submit assessment | ✔ | ✔ | **PARTIALLY OFFLINE** | Server upsert → replay-safe; but the RHI/score returned is server-computed | `sync_queue` | SUBMIT last in order |
| Discard assessment | ✔ | — | REQUIRES PRODUCT DECISION | Destructive; replaying a stale discard could delete answers made elsewhere | — | — |
| Assessor visit gate | — | ✔ | **ONLINE REQUIRED today** | `access` derives from `visitSlice.activeVisit` (API) + socket status | cached active visit | REQUIRES PRODUCT DECISION |
| Monitoring forms (9 modules) | ✔ | — | **FULLY OFFLINE for rendering** | Definitions are compiled into the app | — | — |
| Monitoring record create/edit | ✔ | — | **PARTIALLY OFFLINE** | Server UUID, no unique key → duplicate risk | `monitoring_records` + `sync_queue` | CREATE/UPDATE |
| Monitoring / field documents | ✔ | — | **PARTIALLY OFFLINE** | multipart file outbox | `media_files` + filesystem | upload |
| Enrollment (enroll / unenroll) | ✔ | — | **ONLINE REQUIRED (recommended)** | Capacity allocation can fail on sync after the user was told it worked | — | REQUIRES PRODUCT DECISION |
| Dashboard / RHI cards | ✔ | — | **FULLY OFFLINE (stale)** | Server-derived; local answers will not move the numbers until sync | `dashboard_snapshots` | pull |
| Reports screen | ✔ | — | **FULLY OFFLINE (stale)** | Reads the dashboard slice, no own API | same as dashboard | pull |
| Notifications | ✔ | ✔ | FULLY OFFLINE (stale) | Read cache; mark-read queueable | `notifications` | outbox |
| Live visit tracking | ✔ | ✔ | **ONLINE REQUIRED** | Real-time by definition | — | — |
| Signup / OTP / password reset | ✔ | ✔ | **ONLINE REQUIRED** | — | — | — |

---

## Summary counts

* **FULLY OFFLINE (read):** 14 features — all of them just need a local cache.
* **FULLY OFFLINE (write):** 1 feature — assessment answers (score + comment).
* **PARTIALLY OFFLINE:** 12 features — all need the outbox and, for 6 of them, local ids.
* **ONLINE REQUIRED:** 9 features.
* **REQUIRES PRODUCT DECISION:** 3 — enrolment, discard, assessor visit gate.
* **REQUIRES BACKEND CHANGE:** duplicate-safe creates (farms, fields, monitoring
  records). Everything else can ship without touching the backend.
