# 10 — IDs, Idempotency and Conflicts

---

## 1. Local id vs server id

### Which entities need both

| Entity | Creatable offline? | `local_id` | `server_id` | Reason |
|---|---|---|---|---|
| `users` | No | — | PK | Accounts are only created online |
| `farms` | **Yes** | ✅ PK | ✅ nullable | Server generates the UUID (`prisma.farms.create`) |
| `fields` | **Yes** | ✅ PK | ✅ nullable | Server generates the UUID (`prisma.fields.create`) |
| `field_boundaries` | Yes | keyed by `field_local_id` | — | Boundary has no id of its own; it is a column on the field |
| `field_soil` | Yes | keyed by `field_local_id` | — | 1:1 with the field, upserted |
| `monitoring_records` | **Yes** | ✅ PK | ✅ nullable | Server generates the UUID |
| `documents` | Yes | ✅ PK | ✅ nullable | Server generates it on upload |
| `media_files` | Yes | ✅ PK | remote URL | The "id" that matters is the returned URL |
| `assessments` | Yes (implicitly) | ✅ PK | nullable | The row only exists server-side once answers/submit land |
| `assessment_answers` | **Yes** | ✅ PK | ✅ nullable | But the **natural key** is `(field, question, role, program)` — see §2 |
| `programs`, `assessment_categories`, `assessment_questions`, `notifications` | No | — | PK | Read-only caches |

`local_id` = UUID v4 generated on device. `react-native-uuid` (2.0.4) is the obvious
choice, or `crypto.randomUUID()` if the Hermes build exposes it — verify, do not
assume.

### The rule

```
local_id   never changes, ever. It is the app's own identity for the row.
server_id  is NULL until the CREATE flushes, then written once and never changed.
Foreign keys inside SQLite always reference local_id.
Server ids are resolved only at the moment a request URL/body is built.
```

Never rewrite `local_id` to the server value on sync. Every screen, navigation param
and queue entry that already holds the local id would break.

### Dependency chain

```
Offline farm            (farms.local_id = L1, server_id = NULL)
   └── Offline field    (fields.local_id = L2, farm_local_id = L1, server_id = NULL)
         └── boundary   (field_local_id = L2)
         └── monitoring (monitoring_records.local_id = L3, field_local_id = L2)

on reconnect:
  POST /farms/me/farms                  → S1   → farms.server_id = S1
  POST /farms/S1/fields                 → S2   → fields.server_id = S2
  POST /field-monitoring/fields/S2/...  → S3   → monitoring_records.server_id = S3
```

Assessments are the exception that makes them easy: the assessor and the enrolled
farmer only ever assess fields that **already have server ids**, because enrolment
is online-only. So the entire assessment path — the highest-value offline feature —
has **no id resolution problem at all**.

---

## 2. Idempotency analysis

The scenario that must be answered: **the request reaches the server, the server
commits, the response is lost** (tunnel, process kill, timeout). The app still sees a
failure and retries.

### Verified per operation

| Operation | Server behaviour | Duplicate on retry? | Evidence |
|---|---|---|---|
| `PUT .../questions/{q}/answer` | `INSERT … ON CONFLICT (field_id, question_id, author_role, program_id) DO UPDATE` | **No — safe** | `backend/src/models/assessmentMobile.model.ts:678`; `migrations/025:45` |
| `POST .../submit` | `INSERT INTO field_assessments … ON CONFLICT (field_id, author_role, program_id) DO UPDATE` | **No — safe** (`submitted_at` re-stamped) | `assessmentMobile.model.ts:878`; `migrations/025:50` |
| `PUT /fields/{id}/soil` | upsert against `uq_field_soil_field_alive` | **No — safe** | `migrations/018:24` |
| `PUT .../fields/{id}/boundary` | writes a column on `fields` | **No — safe** | column write, not an insert |
| `PATCH` farm / field | targeted update by id | **No — safe** | idempotent by nature |
| `DELETE` farm / field / document | soft delete by id | **No — safe** (second call 404s, treat as success) | |
| **`POST /farms/me/farms`** | `prisma.farms.create`, server UUID, **no unique key on (owner, name)** | **YES — duplicate farm** | `backend/src/models/farm.model.ts:103`; no matching `CREATE UNIQUE INDEX` in `migrations/` |
| **`POST /farms/{id}/fields`** | `prisma.fields.create`, server UUID, no unique key | **YES — duplicate field** | `backend/src/models/field.model.ts:116` |
| **`POST .../modules/{module}`** | create, server UUID, no unique key | **YES — duplicate record** | `fieldMonitoringApi.createRecord`; no unique index found |
| `POST /assessments/evidence` | stores a file, returns a URL | **YES — orphan file** (harmless, wastes storage) | `assessmentApi.uploadEvidence` |
| `POST /programs/{id}/enroll-self` | has `uq_program_enrollments_alive` | Probably safe | `migrations/019:52` — verify before relying on it |
| `POST /visits` | has `uq_field_visits_active_assessor` | Probably safe | `migrations/023:45` |

### Does the backend support idempotency keys, client ids, or upsert?

Audited: **no** to the first two, **partially** to the third.

* **Idempotency keys:** no `Idempotency-Key` header handling anywhere in
  `backend/src`. No such middleware.
* **Client-generated ids:** no create endpoint accepts an `id` in its body. Every
  `prisma.*.create` lets Postgres generate `gen_random_uuid()`.
* **Upsert / duplicate detection:** present, and well done, exactly where it
  matters most for us — assessment answers, submits, soil, enrolment, visits. Absent
  for farms, fields and monitoring records.

### Risk statement (no backend change requested)

> Offline creation of **farms**, **fields** and **monitoring records** carries a real
> duplicate-record risk whenever a create request succeeds server-side but its
> response is lost. The client cannot fully prevent this. Offline creation of
> **assessment answers and submits** carries no such risk.

### Client-side mitigations available today (none of them complete)

1. **Never auto-retry a create after an ambiguous failure.** Ambiguous = timeout or
   no response *after the request was sent*. Mark the queue entry
   `needs_verification` instead of `queued`.
2. **Verify before retrying.** Before re-sending a farm CREATE, `GET /farms/me/farms`
   and look for a row matching name + area + created-at window. If found, adopt its id
   and mark the entry done. This is a heuristic, not a guarantee — two farms genuinely
   named "North Block" of the same size would collide.
3. **Generate and store an `idempotency_key`** in `sync_queue` now, even though the
   backend ignores it. It costs nothing today and makes the backend fix a one-line
   client change later.
4. **Show the user.** If verification is inconclusive, surface "This farm may have
   already been created — check your farm list" rather than silently duplicating.

### The backend change to request (documented, not made)

Smallest useful version, in priority order:

1. Accept an optional **client-supplied UUID** on `POST /farms/me/farms`,
   `POST /farms/{id}/fields`, and `POST /field-monitoring/fields/{id}/modules/{m}`,
   and make the insert an `ON CONFLICT (id) DO NOTHING RETURNING`. This solves the
   problem completely and is the cheapest fix — it also removes the entire id
   resolution chain in §1, since local ids would become the server ids.
2. Or: accept an `Idempotency-Key` header and store request/response pairs for 24 h.
3. Or: add unique indexes like `uq_farms_owner_name_alive` so a duplicate insert
   fails loudly instead of succeeding quietly.

Option 1 is by far the best value and would simplify the mobile design dramatically.

---

## 3. Conflict analysis

### What can genuinely conflict

| Data | Concurrent writer | Can conflict? | Severity |
|---|---|---|---|
| Assessment answer (farmer) | The same farmer on another device; nobody else | Low probability | Low — one scalar score + comment |
| Assessment answer (assessor) | The same assessor on another device | Low probability | Low |
| Farmer vs assessor answers on the same question | **Cannot conflict** — separate rows, `author_role` is in the unique key | No | — |
| Assessment lock/submit | An admin or the assessor submitting while the farmer is offline | **Yes** | **High** — offline answers become unsavable against a submitted assessment |
| Farm / field attributes | Another device, or an admin on the web console | Yes | Medium — last-write-wins silently loses a field edit |
| Field boundary | Another device | Yes | Medium — a whole polygon is lost, not one attribute |
| Soil record | Another device | Yes | Low |
| Monitoring record | Another device | Yes | Low |
| Enrolment / unenrolment | Admin, or program capacity filling up | **Yes** | **High** — invalidates the program scope every answer was captured under |
| Deleted-while-offline (farm/field deleted server-side) | Admin | **Yes** | **High** — queued children will 404 |

### Does the backend provide versioning?

**No.** Audited:

* No `version`, `etag`, `rev` or `If-Match` handling anywhere in `backend/src`.
* Rows carry `updated_at`, but **no endpoint accepts a conditional update** based on
  it. There is no way for the client to say "only if unchanged since X".
* Reads do not return `ETag` headers.

### Is last-write-wins currently implied?

**Yes, unavoidably.** Every write is unconditional. Today that is nearly harmless
because writes are immediate and online. Introducing offline writes stretches the
window from milliseconds to hours or days, which is exactly what turns an
implied-LWW system into a data-loss system.

### Could data loss occur?

**Yes**, in these concrete cases:

1. Farmer edits Q7's comment offline; from the web console the same answer is edited;
   the farmer syncs 6 hours later and the console edit is silently overwritten.
2. Assessor submits the assessment while the farmer is offline; the farmer's queued
   answers are rejected (or worse, accepted against a submitted assessment).
3. Two devices edit the same field's boundary; the later flush replaces the polygon
   entirely.
4. An admin deletes a field; the queued monitoring records for it 404 and are lost
   unless surfaced.

### Recommended stance (given no backend versioning)

Do **not** invent a conflict-resolution algorithm the backend cannot support. Instead:

1. **Detect, don't resolve.** On pull, if a row's `sync_status` is `synced` but the
   server's `updated_at` is newer than our `last_pulled_at` *and* we hold local
   changes, mark it `conflict` and stop syncing that row.
2. **Surface it.** A "Needs your attention" list showing "Your version" vs "Server
   version", with Keep-mine / Keep-server. Manual resolution is honest; silent LWW
   is not.
3. **Shrink the window.** Flush on every reconnect and every app foreground, not on a
   timer. Most conflicts are prevented by syncing sooner.
4. **Guard the high-severity cases specifically:**
   * before flushing answers, re-fetch the assessment summary; if `locked` or
     `COMPLETED`, stop and tell the user rather than pushing;
   * if a parent 404s, mark the whole dependent subtree `failed` with an explanation,
     never silently drop it;
   * keep enrolment online-only, which removes the worst case entirely.
5. **Document the requirement.** The proper fix is a backend `version` column plus
   `If-Match` / 409 on the mutable entities. Record it as a requirement; do not
   pretend to solve it client-side.

### What genuinely cannot conflict (and can therefore be trusted)

* Assessment answers between farmer and assessor — different rows by design.
* Anything read-only (programs, categories, questions, dashboard snapshots).
* Media uploads — each upload creates a new file and returns a new URL.
* Locally-created entities before their first sync — nobody else has ever seen them.
