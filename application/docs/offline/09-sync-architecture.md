# 09 — Sync Architecture (design only, not to be built yet)

We are **not** implementing sync now. The point of this document is that the
database foundation built in earlier phases must not block it.

---

## 1. Layered target

```
                        UI (screens/components)
                                 │
                        Redux + hooks  ── UI state only
                                 │
                          Repository layer
                       /                    \
                 SQLite                    API (axios)
             (source of truth)          (remote authority)
                    │                          ▲
              sync_queue ──────────────────────┘
                    │
             Sync engine (Phase 8+)
                    ▲
        connectivity (NetInfo) + socket 'sync' + app foreground
```

Reads always come from SQLite. Writes always go to SQLite **and** `sync_queue` in
one transaction. The API is never called directly by a screen again.

---

## 2. `sync_queue` schema

```
id                INTEGER PRIMARY KEY AUTOINCREMENT   -- insertion order = FIFO
owner_user_id     TEXT NOT NULL                       -- account isolation (13)
entity_type       TEXT NOT NULL                       -- farm|field|boundary|soil|
                                                      -- assessment_answer|assessment_submit|
                                                      -- monitoring_record|document|media|profile
entity_local_id   TEXT NOT NULL                       -- row this operation belongs to
operation         TEXT NOT NULL                       -- CREATE|UPDATE|DELETE|SUBMIT|UPLOAD
payload_json      TEXT                                -- see §3 — usually a hint, not the body
depends_on_id     INTEGER NULL                        -- FK to sync_queue.id
status            TEXT NOT NULL                       -- queued|in_flight|failed|done|blocked
retry_count       INTEGER NOT NULL DEFAULT 0
next_attempt_at   TEXT                                -- backoff schedule
last_error        TEXT
last_http_status  INTEGER NULL
idempotency_key   TEXT                                -- client-generated UUID (10)
created_at        TEXT NOT NULL
updated_at        TEXT NOT NULL
```

Indexes: `idx_queue_status_next (status, next_attempt_at)`,
`idx_queue_entity (entity_type, entity_local_id)`, `idx_queue_owner (owner_user_id)`.

---

## 3. Payload: reference, not snapshot

The queue stores a **reference** to the row plus the minimum discriminating context;
the request body is **rebuilt from the current SQLite row at flush time**.

Why this matters concretely:

* The farmer answers Q7 offline (score 2), then edits it (score 3), then adds a
  photo. A snapshot queue would hold three payloads and replay three requests,
  the last two of which are redundant. A reference queue holds **one** entry and
  sends the row's final state.
* The evidence flow in `07` §5 *requires* rebuilding `evidenceUrls` from
  `media_files` at flush time. A frozen snapshot would drop a photo added after
  queueing.
* `buildAnswerPayload`'s "only send fields the user touched" semantics must be
  re-derived at flush time to avoid wiping comments/photos
  (`backend/src/models/assessmentMobile.model.ts:683-691`).

`payload_json` is therefore used only for things not recoverable from the row —
e.g. a DELETE needs the `server_id` that is about to be removed, and a SUBMIT needs
`(programId, fieldId, role)`.

Enqueueing is **coalescing**: an `UPDATE` for an entity that already has a `queued`
`UPDATE` does not add a row, it just bumps `updated_at`. A `CREATE` followed by
`UPDATE`s stays a single `CREATE`. `CREATE` + `DELETE` before flush cancels both.

---

## 4. Dependency ordering (derived from the actual APIs)

Ordering is **not** a global list; it falls out of which URLs need a server id.

```
farm CREATE ────────────────► farms.server_id
   ├── farm UPDATE / DELETE            needs farm.server_id
   └── field CREATE ─────────► fields.server_id      (URL: /farms/{SERVER farmId}/fields)
         ├── field UPDATE / DELETE     needs farm.server_id + field.server_id
         ├── boundary PUT              needs both        (prefer inlining into field CREATE)
         ├── soil PUT                  needs field.server_id
         ├── field document UPLOAD     needs field.server_id
         ├── monitoring record CREATE ─► record.server_id
         │      └── monitoring doc UPLOAD   needs field.server_id (+ record.server_id)
         └── assessment answers        needs field.server_id + programId (enrolment: online)
                └── media UPLOAD  ──►  re-PUT answer with URLs
                       └── assessment SUBMIT      strictly last for that (program, field)
```

Implementation: when an entry is enqueued whose parent has no `server_id`, set
`depends_on_id` to the parent's queue entry and `status = 'blocked'`. When the
parent's `CREATE` succeeds and writes `server_id`, unblock its dependants. The
engine then only ever picks up `status = 'queued' AND next_attempt_at <= now`
in `id` order.

---

## 5. Flush algorithm

```
trigger: NetInfo → online   |  app foreground  |  socket 'connect'  |  manual pull-to-sync

if (!online || !authenticated || flushInProgress) return
flushInProgress = true

while (entry = nextQueued(owner_user_id)):
    mark in_flight
    body = rebuildFromRow(entry)            // §3
    try:
        response = call(entry, body)
        applyServerResponse(response)       // backfill server_id, server_updated_at
        mark done; unblock dependants
    catch e:
        if (e.kind === 'offline')            → mark queued, stop the whole loop
        if (status 401)                      → refresh once; if it fails, stop and keep the queue
        if (status 409/422/400 validation)   → mark failed, surface to the user, continue
        if (status >= 500 or timeout)        → retry_count++, exponential backoff, continue
        if (retry_count > MAX)               → mark failed, surface

flushInProgress = false
after a successful flush: invalidate the affected sync tags → pull fresh server state
```

Backoff: 2 s, 8 s, 30 s, 2 min, 10 min, capped; `MAX_RETRIES = 6`. A `failed` entry
never blocks unrelated entries, but it **does** block its own dependants — a farm
that will not create must not let its fields try.

Only **one** flush loop may run at a time, process-wide. Reuse the pattern already
proven in `services/http.ts`'s `refreshPromise` singleton.

---

## 6. Reusing the sync machinery that already exists

Do not invent a second invalidation system. The app already has a good one:

| Existing piece | Reuse as |
|---|---|
| `redux/syncTags.ts` `Tags` + `tagsForSync()` | The tag vocabulary for `sync_state`, and for deciding what to re-pull after a flush |
| `syncSlice.WRITE_INVALIDATIONS` | Already maps every write thunk to the tags it dirties — the sync engine emits the same tags after each flushed entry |
| `bumpSyncEpoch()` on socket reconnect | Already the "I may have missed events, refresh everything" recovery. Keep it, and let it drive a pull pass |
| `useSyncedFetch` | Keep the hook; change `run()` to read from SQLite and, when online and stale, trigger a pull |
| `handleApiError().kind === 'offline'` | The classifier the engine keys off. Already implemented, currently unused |
| `markDashboardStale(farmId)` | Already the "local write invalidated a server-derived number" signal — generalise it to `dashboard_snapshots.stale` |
| `boundaryRepository` local-first pattern | The reference implementation for every other repository |

---

## 7. Pull side (server → local)

Push is only half of sync. The pull side, per tag:

```
online + tag stale (socket event, epoch bump, or TTL) →
    GET the list/detail endpoint →
    upsert into SQLite by server_id →
    for rows with local changes (sync_status != 'synced'): DO NOT overwrite; flag for conflict (10)
    update sync_state.last_pulled_at
```

The rule that keeps this safe: **a pull may never overwrite a row whose
`sync_status` is `local` or `pending`.** Pull writes only into `synced` rows, or
creates new ones.

---

## 8. Connectivity detection

`@react-native-community/netinfo` (latest 12.0.1, 2026-02-14, peer
`react-native >= 0.59`) is not currently a dependency and would be the one new
runtime dependency besides SQLite.

Important nuance: NetInfo reports *link* state, not *reachability*. A farmer on a
tower with no backhaul is "connected" and every request still times out. So:

* Treat NetInfo as a **fast negative** ("definitely offline → do not even try").
* Treat `handleApiError().kind === 'offline'` as the **authoritative positive**
  ("we tried and the network is not usable") and let it flip the app into offline
  mode without waiting for NetInfo.

---

## 9. What this design deliberately does not do

* **No CRDTs, no operational transform.** The data is per-user and the write unit is
  a single scalar answer; the complexity is not justified.
* **No background sync.** See `12` — both platforms make truly reliable background
  execution hard, and a farmer who opens the app in town syncs then. Foreground-only
  is a feature, not a shortcut.
* **No delta/changed-since pulls.** No endpoint supports `?since=`. Pulls are full
  refetches of the affected tag. Fine at this data volume.
* **No local scoring.** RHI and percentages stay server-computed; locally they are
  shown as snapshots with an "as of" stamp.
