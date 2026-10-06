# 15 — Testing Strategy (future)

The app currently has `jest` + `react-test-renderer` configured with a small
`__tests__` folder. Offline work needs three tiers on top of that: unit tests for
pure logic, integration tests against a real SQLite instance, and a manual device
matrix — because the failure modes that matter (process death, OS purges, lost
responses) cannot be reproduced in Jest.

---

## 1. Unit (Jest, no device)

| Target | What to assert |
|---|---|
| Migration runner | v0→v1→v2 applies once, is idempotent, and rolls back a failed step |
| Queue coalescing | CREATE+UPDATE → one CREATE; CREATE+DELETE → nothing; UPDATE+UPDATE → one entry |
| Dependency resolution | Child stays `blocked` until the parent has a `server_id`; unblocks on success; stays blocked when the parent fails |
| Payload rebuild | An answer with 2 uploaded + 1 pending photo rebuilds `evidenceUrls` correctly at flush time |
| Partial-update semantics | A score-only save does not clear `comment` / `evidenceUrls` (mirrors the backend's `ON CONFLICT` partial set) |
| Backoff schedule | 2 s → 8 s → 30 s → … capped; `MAX_RETRIES` respected |
| Error classification | `kind === 'offline'` vs 401 vs 422 route to keep-queued / refresh / fail |
| Progress derivation | Locally-computed answered counts match the server's for the same data |
| Boundary geometry | Unchanged by the migration — existing behaviour must be pinned first |
| `owner_user_id` scoping | Every repository read is scoped; a fabricated second user's rows never appear |

---

## 2. Integration (SQLite on a device/emulator)

Run against a real database, not a mock.

* Full flush of a mixed queue in the correct order.
* Pull does not overwrite `local` / `pending` rows.
* Conflict detection fires when server `updated_at` > `last_pulled_at` and local
  changes exist.
* 1000 answers inserted in one transaction; read back; timing recorded.
* DB opens after upgrade from schema vN with pending queue entries intact.

---

## 3. Online baseline (must not regress)

Before any offline work is trusted, prove these still pass, because every one of
them is a path Phase 3 rewrites:

```
create farm → appears in list and dashboard
create field (location + boundary) → appears under the farm
edit field, edit boundary
enrolla field in a program
download an assessment → answer → submit → history + RHI update
monitoring: create / edit / delete a record in each of the nine modules
upload and delete a field document, a monitoring document, an evidence file
assessor: start visit → arrive → assess → submit
```

---

## 4. Offline scenarios

### 4.1 Cold start
```
log in online → force-quit → aeroplane mode → launch
EXPECT: still logged in, farmer shell, cached data, offline banner, no error toasts
```

### 4.2 Create and survive restart
```
offline → create farm → force-quit → reopen        → farm present, Pending badge
offline → create field (GPS + boundary) → force-quit → reopen → field + boundary present
offline → fill a monitoring record → force-quit → reopen → record present
```

### 4.3 Assessment endurance (the headline test)
```
online:  download field assessment
offline: answer 20 questions, add comments, attach 2 photos
         kill the app mid-question
         reopen → resumes at the right question, all 20 answers intact
         answer 10 more, edit 3 earlier answers
         open the review screen → shows all answers, derived locally
online:  flush → server shows exactly 30 answers, correct scores, photos attached
         re-open on a second device → identical
```

### 4.4 Assessor
```
online:  start visit → arrive
offline: complete the assessment, submit
online:  flush → submitted, one assessment row, farmer's answers untouched
```

### 4.5 Network transitions
| Transition | Expected |
|---|---|
| Online → offline mid-fetch | Banner appears, cached data stays, no toast |
| Online → offline mid-upload | Upload marked pending, retried later, file still on disk |
| Offline → online | Auto flush starts, badges clear, banner disappears |
| Online → weak (high latency, packet loss) | Requests time out → treated as offline → queued, not failed |
| Weak → offline | No duplicate queue entries; single flush lock holds |
| Offline → online → offline mid-flush | Partial flush persists; `in_flight` resets to `queued` on next launch |
| Airplane toggle 10× rapidly | Exactly one flush loop; no duplicate writes |

### 4.6 Failure scenarios
| Scenario | How to induce | Expected |
|---|---|---|
| API timeout | proxy delay > timeout | queued, retried with backoff |
| Server 500 | proxy rewrite | retried, then `failed` + surfaced |
| Token expired mid-flush | expire the token server-side | one refresh, flush resumes; on refresh failure the queue is **kept**, not dropped |
| App killed during flush | force-quit mid-flush | `in_flight` → `queued` on launch; **no duplicate** for idempotent ops |
| **Response lost after a successful create** | proxy: forward the request, drop the response | **The known duplicate risk (`10`). Assert the app does NOT blind-retry, and that the verification path or the user warning fires** |
| Device restart with pending data | reboot | queue and files intact |
| Partial multi-file upload | fail file 2 of 3 | files 1 and 3 uploaded, 2 retried, answer references all three only after 2 lands |
| Local file deleted by the OS | delete from `outbox/` manually | media marked `failed`, user told which record lost its attachment |
| Parent deleted server-side | delete the farm via another client | child queue entries → `failed` with an explanation, never silently dropped |
| Assessment submitted elsewhere | submit via the web console | pre-flush guard stops the push and tells the user |
| DB corrupt / unopenable | corrupt the file | recovery path: warn, clear, re-pull; never a crash loop |
| Storage full | fill the device | capture refuses with a clear message before writing a partial file |

---

## 5. Android-specific

* **"Don't keep activities"** enabled — the cheapest way to reproduce process death.
* Doze: `adb shell dumpsys deviceidle force-idle`.
* An OEM-aggressive handset (Xiaomi / Oppo / Vivo / Samsung) with battery
  optimisation **on** — the real-world worst case.
* "Clear cache" → outbox and DB must survive.
* "Clear storage" → app recovers gracefully from "token present, DB empty".
* Low-storage device: outbox cap enforced.
* API 24 (minSdk) and API 36 (target) both.
* SD-card-backed `ExternalDirectoryPath` if the outbox lands there.

## 6. iOS-specific

* Background → wait 10 min → return: state intact, `in_flight` reset.
* Force-quit (swipe up) mid-write: last committed write present.
* Low-storage warning: `tmp` purged — assert the outbox copy saved the file.
* iCloud backup → restore to another device: assert the `device_install_id`
  quarantine fires and the queue is not auto-flushed (`12`).
* iOS 15.1 (deployment target) and current iOS.
* A `use_frameworks!` build, if that configuration is used in CI.

---

## 7. Multi-user

```
Farmer A logs in → creates offline data → logs out (queue empty)
Farmer B logs in → sees ZERO of A's data anywhere
Farmer A logs back in → sees their data per the retention policy
Farmer A with a NON-empty queue attempts logout offline
   → EXPECT a blocking warning, not silent destruction
Assessor A → logout → Assessor B → no cross-visibility of assigned farmers
Delete account → every row and file for that user is gone, queue included
```

---

## 8. Data-integrity assertions (run after every offline scenario)

```
1. server answer count            == local answer count for that (program, field, role)
2. every local score/comment      == the server's
3. no duplicate farms / fields / monitoring records
4. every uploaded photo is referenced by exactly one answer/document
5. sync_queue is empty and no entry is 'failed' unless deliberately induced
6. dashboard/RHI on the server reflects the synced answers
7. no row anywhere carries a foreign owner_user_id
```

---

## 9. Definition of done for the whole programme

A farmer and an assessor each spend **a full working day with no connectivity**,
doing their normal work — creating farms and fields, drawing boundaries, filling
monitoring forms, completing assessments with photos — return to signal, and
**every item they entered appears on the server exactly once, with nothing lost and
nothing duplicated**, without either of them having to think about sync at any point.
