# 04 — Proposed SQLite Database Architecture

**Nothing here is implemented.** This is the target schema for review.

Design rules applied throughout:

1. Every row is scoped to the account that fetched it (`owner_user_id`) — see `13`.
2. Every entity that can be created offline carries **both** `local_id` and
   `server_id`. `local_id` is the primary key; `server_id` is nullable until sync.
3. Every mutable row carries `sync_status` and `updated_at_local`.
4. Server-derived/computed data (dashboard, RHI, review) is cached as a **snapshot**,
   never treated as authoritative local state.
5. Binaries never go in SQLite — only paths and metadata (`11`).

`sync_status` domain (matches the vocabulary already used by
`maps/boundary/types.ts`, which has `'local' | 'pending' | 'synced' | 'conflict'`):

```
'synced'   — matches the server as of last_pulled_at
'local'    — created/edited locally, not yet queued
'pending'  — queued in sync_queue, awaiting or mid-flight
'conflict' — server rejected or returned a divergent version
'failed'   — exhausted retries; needs user action
```

---

## Entity overview

```
users
 └── farms ──────────── fields ─────┬── field_boundaries
                                    ├── field_soil
                                    ├── documents
                                    ├── monitoring_records ── documents
                                    └── assessments ── assessment_answers ── media_files
programs ── assessment_categories ── assessment_questions
dashboard_snapshots
sync_queue
sync_state
app_meta
```

---

## Table specifications

### `app_meta`

| | |
|---|---|
| Purpose | Schema version + one-off flags. `PRAGMA user_version` holds the numeric schema version; this table holds everything else. |
| PK | `key TEXT` |
| Fields | `key`, `value TEXT`, `updated_at` |
| Server id | none |
| Offline usage | migration runner, "last full prefetch at", active account id |
| Sync | none |

### `users`

| | |
|---|---|
| Purpose | The cached identity of every account that has logged in on this device. Enables offline cold start (`01` blocker #1) and account isolation (`13`). |
| PK | `id TEXT` (server user UUID — users are never created offline) |
| Fields | `id`, `full_name`, `email`, `phone`, `role`, `email_verified`, `avatar_url`, `org_id`, `org_name`, `last_login_at`, `last_pulled_at` |
| FKs | — |
| Indexes | `uq_users_email` |
| Offline usage | restore session without `/auth/me`; scope every other table |
| Sync | pull only (`GET /profile/me`, `GET /auth/me`) |

### `farms`

| | |
|---|---|
| Purpose | Farmer's farms; offline-creatable. |
| PK | `local_id TEXT` (UUID v4 generated on device) |
| Server id | `server_id TEXT NULL UNIQUE` |
| FKs | `owner_user_id → users.id` |
| Fields | `name`, `business_entity`, `area_acres REAL`, `used_area REAL`, `available_area REAL`, `field_count INTEGER`, `location TEXT` (address string), `latitude REAL`, `longitude REAL`, `is_active`, `org_id`, `org_name`, `address_resolved INTEGER` (0 when the reverse geocode still owes us a string — see `08`), `sync_status`, `created_at`, `updated_at`, `updated_at_local`, `last_pulled_at`, `deleted_local INTEGER` |
| Indexes | `idx_farms_owner`, `uq_farms_server_id`, `idx_farms_sync_status` |
| Offline usage | list, detail, create, edit |
| Sync | CREATE / UPDATE / DELETE via `sync_queue`; `server_id` backfilled on CREATE success |

### `fields`

| | |
|---|---|
| Purpose | Fields within a farm; offline-creatable. |
| PK | `local_id TEXT` |
| Server id | `server_id TEXT NULL UNIQUE` |
| FKs | `farm_local_id → farms.local_id`, `owner_user_id → users.id` |
| Fields | `name`, `area_acres REAL`, `crop`, `season`, `irrigation`, `status` (`healthy`/`monitor`/`critical`), `location`, `latitude`, `longitude`, `sowing_date`, `expected_harvest`, `weather`, `has_boundary INTEGER`, `boundary_updated_at`, `address_resolved`, `sync_status`, `created_at`, `updated_at`, `updated_at_local`, `last_pulled_at`, `deleted_local` |
| Indexes | `idx_fields_farm`, `idx_fields_owner`, `uq_fields_server_id`, `idx_fields_sync_status` |
| Offline usage | list, detail, create, edit |
| Sync | CREATE blocked until the parent farm has a `server_id` (`10`) |

### `field_boundaries`

Kept separate from `fields` because the boundary is edited independently, has its
own version counter, and already has a local-first implementation to migrate
(`redux/slices/boundarySlice.ts` → this table).

| | |
|---|---|
| PK | `field_local_id TEXT` (1:1 with `fields`) |
| FKs | `field_local_id → fields.local_id`, `farm_local_id → farms.local_id` |
| Fields | `ring_json TEXT` (array of `{latitude, longitude}`), `geojson TEXT` (Polygon, exactly what the API takes), `area_sq_m REAL`, `center_lat`, `center_lng`, `bbox_min_lat/min_lng/max_lat/max_lng`, `version INTEGER`, `sync_status`, `updated_at`, `updated_at_local` |
| Indexes | `idx_boundaries_sync_status` |
| Offline usage | draw, edit, render, area readout — all fully local |
| Sync | `PUT /farms/{farmId}/fields/{fieldId}/boundary`, or inlined into the field CREATE |

### `field_soil`

| | |
|---|---|
| PK | `field_local_id TEXT` |
| Fields | `ph`, `organic_matter`, `nitrogen`, `phosphorus`, `potassium`, `moisture` (all REAL NULL), `texture`, `notes`, `tested_on`, `locked INTEGER`, `sync_status`, `updated_at_local`, `last_pulled_at` |
| Sync | `PUT /fields/{fieldId}/soil` — shape-idempotent, server has `uq_field_soil_field_alive` |

### `programs`

| | |
|---|---|
| Purpose | Programs the farmer can see / is enrolled in. Read-only cache; enrolment itself stays online (`02` A.9). |
| PK | `id TEXT` (server id) |
| Fields | `owner_user_id`, `name`, `code`, `description`, `type`, `start_date`, `end_date`, `user_limit`, `enrolled_count`, `is_full`, `already_enrolled`, `can_enroll`, `survey_url`, `survey_acres`, `last_pulled_at` |
| Sync | pull only |

### `program_fields`

| | |
|---|---|
| Purpose | Which fields are enrolled in which program — the (program, field) pair that every assessment URL needs. |
| PK | `(program_id, field_local_id)` |
| Fields | `enrolled INTEGER`, `last_pulled_at` |
| Sync | pull only |

### `assessment_categories`

| | |
|---|---|
| Purpose | Category list for a program (name + question counts). |
| PK | `(program_id, category_id)` |
| Fields | `name`, `total_questions`, `display_order`, `last_pulled_at` |
| Sync | pull only |

### `assessment_questions`

The **template**. Backend evidence (`backend/src/services/assessmentMobile.service.ts:432`,
`getCategoryQuestionsForField`) shows the question text and score descriptions come
from `assessment_questions` joined to the category — the `fieldId` in the URL only
selects which answers get joined in. So the template can be stored **per
(program, category)** and reused across every field in that program. That is what
makes prefetch cheap.

| | |
|---|---|
| PK | `question_id TEXT` |
| Fields | `program_id`, `category_id`, `question_code`, `question_text`, `guidance_note`, `score0_description`, `score1_description`, `score2_description`, `score3_description`, `display_order`, `last_pulled_at` |
| Indexes | `idx_questions_program_category` |
| Offline usage | render the whole question flow with no network |
| Sync | pull only. **Verify the per-field independence with one API diff before relying on it** (`14`, Phase 6). |

### `assessments`

One row per (program, field, author_role) — mirrors the server's
`uq_field_assessments_field_role_program`.

| | |
|---|---|
| PK | `local_id TEXT` |
| Server id | `server_id TEXT NULL` (the `field_assessments.id`, only known after submit) |
| FKs | `field_local_id`, `program_id`, `owner_user_id` |
| Fields | `author_role` (`farmer`/`assessor`), `title`, `year`, `status` (`PENDING`/`IN_PROGRESS`/`COMPLETED`), `total_questions`, `answered`, `percentage REAL`, `submitted_at`, `submit_pending INTEGER`, `locked INTEGER`, `sync_status`, `updated_at_local`, `last_pulled_at` |
| Indexes | `uq_assessments_scope (program_id, field_local_id, author_role)` |
| Offline usage | summary screen, progress bars, resume | 
| Sync | SUBMIT via `sync_queue`; counters recomputed locally from `assessment_answers` |

### `assessment_answers`

The highest-value table in the whole design.

| | |
|---|---|
| PK | `local_id TEXT` |
| Server id | `server_id TEXT NULL` |
| FKs | `assessment_local_id → assessments.local_id`, `question_id → assessment_questions.question_id` |
| Fields | `field_local_id`, `program_id`, `author_role`, `score INTEGER (0..3)`, `comment TEXT`, `evidence_urls_json TEXT` (server URLs already uploaded), `sync_status`, `created_at`, `updated_at`, `updated_at_local`, `server_updated_at`, `last_pulled_at` |
| Indexes | `uq_answer_scope (assessment_local_id, question_id)`, `idx_answers_sync_status` |
| Offline usage | answer, edit, resume, locally-derived review and progress |
| Sync | UPDATE via `sync_queue`. **Idempotent** — the server does `INSERT … ON CONFLICT (field_id, question_id, author_role, program_id) DO UPDATE` (`backend/src/models/assessmentMobile.model.ts:678`), so replaying is safe (`10`). |

### `media_files`

Local binaries pending upload, plus cached downloads. See `11`.

| | |
|---|---|
| PK | `local_id TEXT` |
| Server id | `server_id TEXT NULL`, `remote_url TEXT NULL` |
| Fields | `owner_user_id`, `purpose` (`assessment_evidence` / `field_document` / `monitoring_document` / `avatar`), `attached_to_type`, `attached_to_local_id`, `file_path TEXT` (app-private copy), `original_uri TEXT` (where it came from), `file_name`, `mime`, `size_bytes`, `sha256 TEXT NULL`, `upload_status` (`local`/`pending`/`uploaded`/`failed`), `retry_count`, `last_error`, `created_at` |
| Indexes | `idx_media_upload_status`, `idx_media_attached` |
| Offline usage | show a thumbnail immediately, upload later |
| Sync | upload first, then patch the parent record with the returned URL (`09`) |

### `documents`

Metadata for field documents and monitoring documents (the binary lives in
`media_files` or is a remote URL).

| | |
|---|---|
| PK | `local_id TEXT`, `server_id TEXT NULL` |
| Fields | `field_local_id`, `module`, `record_local_id NULL`, `doc_kind`, `name`, `remote_url`, `mime`, `size_bytes`, `uploaded_at`, `media_local_id NULL`, `sync_status`, `deleted_local` |

### `monitoring_records`

| | |
|---|---|
| PK | `local_id TEXT`, `server_id TEXT NULL UNIQUE` |
| FKs | `field_local_id → fields.local_id` |
| Fields | `module TEXT` (one of the nine keys in `config/monitoringModules.ts`), `status`, `notes`, `values_json TEXT` (the whole dynamic value map — the form definition is client-side, so a JSON blob is correct here), `sync_status`, `created_at`, `updated_at`, `updated_at_local`, `last_pulled_at`, `deleted_local` |
| Indexes | `idx_monitoring_field_module`, `idx_monitoring_sync_status` |
| Sync | CREATE / UPDATE / DELETE. **Duplicate risk on CREATE** (`10`). |

### `dashboard_snapshots`

| | |
|---|---|
| Purpose | Cache the two-step dashboard payload verbatim. Explicitly a *snapshot*, not a modelled entity — the numbers are server-derived and will be stale after local writes. |
| PK | `(owner_user_id, scope)` where scope is `'farms'` or `'farm:{serverFarmId}'` |
| Fields | `payload_json TEXT`, `fetched_at`, `stale INTEGER` |
| Sync | pull only; mark `stale = 1` whenever a local write touches that farm (mirrors today's `markDashboardStale`) |

### `notifications` (optional, low priority)

| | |
|---|---|
| PK | `id TEXT` |
| Fields | `owner_user_id`, `type`, `title`, `body`, `read INTEGER`, `created_at`, `read_pending INTEGER` |

### `sync_queue`

Full design in `09`.

| | |
|---|---|
| PK | `id INTEGER PRIMARY KEY AUTOINCREMENT` (insertion order = FIFO) |
| Fields | `owner_user_id`, `entity_type`, `entity_local_id`, `operation` (`CREATE`/`UPDATE`/`DELETE`/`SUBMIT`/`UPLOAD`), `payload_json`, `depends_on_id INTEGER NULL`, `status` (`queued`/`in_flight`/`failed`/`done`), `retry_count`, `next_attempt_at`, `last_error`, `idempotency_key TEXT`, `created_at`, `updated_at` |
| Indexes | `idx_queue_status_next`, `idx_queue_entity` |

### `sync_state`

| | |
|---|---|
| Purpose | Replaces the in-memory `lastFetchedStamp` map in `useSyncedFetch.ts` with something durable, so a cold start knows what is already cached and how old it is. |
| PK | `(owner_user_id, tag)` — `tag` reuses the existing `redux/syncTags.ts` vocabulary (`farms`, `fields:{farmId}`, `assessment:{p}:{f}`, …) |
| Fields | `last_pulled_at`, `stamp INTEGER`, `dirty INTEGER` |

---

## Sizing sanity check

Worst realistic case for one farmer: 5 farms × 6 fields = 30 fields, one program
with ~8 categories × ~10 questions = 80 questions, all 30 fields assessed.

* `assessment_questions`: ~80 rows (shared across fields) — **not** 2400.
* `assessment_answers`: ≤ 2400 rows.
* `monitoring_records`: a few hundred.
* Everything else: hundreds.

Well under a megabyte of structured data. Media dominates storage, and media is on
the filesystem. Performance is not the constraint here; correctness of the sync
layer is.

---

## What deliberately does **not** go into SQLite

| Data | Stays where | Why |
|---|---|---|
| Access / refresh tokens | Keychain / Keystore (`services/tokenStorage.ts`) | Hardware-backed; SQLite is not (`13`) |
| Passwords / OTP codes | nowhere | Never persist credentials |
| Live visit trail (`visitSlice.trail`) | redux only | Real-time, ephemeral, capped at 500 points |
| Socket connection state | redux only | Runtime state |
| Loading / error / `requestedX` flags | redux only | UI state |
| Draft boundary undo/redo stacks (`DraftBoundary.past/future`) | component state | Editor-session scoped |
| Navigation / drawer / modal state | redux + navigation | UI state |
| Form field values mid-edit | component state | Only the committed record is persisted |
