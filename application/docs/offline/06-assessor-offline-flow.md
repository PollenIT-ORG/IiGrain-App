# 06 — Assessor Offline Flow (assessment only)

Scope discipline: the assessor gets **assessment offline and nothing else**, except
what the code proves is a hard dependency of assessment. This document names those
dependencies and stops there.

---

## 1. What the assessor's assessment flow actually touches

Traced from `navigation/AssessorNavigator.tsx`, `api/assessorApi.ts`,
`redux/slices/assessorSlice.ts`, `redux/thunks/assessorThunks.ts`, and
`screens/assessment/shared/useAssessorAssessmentFlow.ts`.

```
GET  /assessor/fields                                    ← the work list
GET  /assessor/programs/{p}/fields/{f}/summary
GET  /assessor/programs/{p}/fields/{f}/categories/{c}/questions/list
GET  /assessor/programs/{p}/fields/{f}/categories/{c}/questions/{q}
PUT  /assessor/programs/{p}/fields/{f}/questions/{q}/answer
GET  /assessor/programs/{p}/fields/{f}/review
POST /assessor/programs/{p}/fields/{f}/submit
```

Plus, as a **gate** rather than as data:

```
GET  /visits/mine/assessor        → visitSlice.activeVisit
POST /visits                      → starts a visit (server id)
socket: visit status transitions  → en_route → arrived
```

Out of scope and to be left alone: `farmer-assessment`, `comparison`,
`AssessorFarmerDetail`, `AssessorFarmDetail`, dashboards, history, visit tracking
maps. They may be cached opportunistically as read-only, but nothing is built for
them.

---

## 2. The visit gate — the assessor's blocker

`useAssessorAssessmentFlow.ts:82` computes access purely from `visitSlice`:

```
no activeVisit                       → 'no_visit'    → locked
activeVisit.fieldId !== this field   → 'other_field' → locked
activeVisit.status === 'en_route'    → 'en_route'    → locked
arrived, this field                  → 'open'
```

`visitSlice.activeVisit` comes from `GET /visits/mine/assessor` and is **not
persisted**. The transition to `arrived` arrives over the socket.

So today: offline ⇒ no `activeVisit` ⇒ `'no_visit'` ⇒ **every assessor assessment
screen is locked**, even with a full local cache.

### Options (all REQUIRE PRODUCT DECISION)

| Option | Description | Cost | Integrity |
|---|---|---|---|
| **A. Persist the active visit** | Cache `activeVisit` in SQLite. If the assessor started the visit while online and then lost signal, the gate stays open on the cached visit for a bounded window (e.g. until `end` or +12 h) | Low | Good — a real visit was actually started and geo-verified |
| **B. Start visits offline** | Queue `POST /visits`, allow assessment, reconcile the visit id on sync | Medium | Weak — the visit's whole point is proving the assessor was on the field; a queued visit proves nothing |
| **C. Keep the gate online-only** | Assessor must have signal at the moment they arrive; after that, offline answering works | Zero | Strongest |

**Recommendation: A.** It preserves the integrity story (the visit was really
started, at the field, with a server timestamp) while covering the realistic
scenario — signal at the gate of the farm, none in the middle of it. B should be
rejected unless the business explicitly says visit provenance is not an audit
requirement.

---

## 3. Data the assessor needs cached before going offline

| Data | Endpoint | Why it is needed |
|---|---|---|
| Assessor identity | `/profile/me`, `/auth/me` | Offline cold start (`05` Step 0) |
| Work list | `GET /assessor/fields` | Which fields they may assess; carries `farmer`, `farm`, `field`, `program`, and the assessment status |
| Active visit | `GET /visits/mine/assessor` | The access gate (§2) |
| Per (program, field): summary | `/assessor/.../summary` | Category list + progress |
| Per category: full questions | `/assessor/.../categories/{c}/questions` | **`Endpoints.assessor.categoryQuestionsFull` already exists and is never called.** One call per category returns text, guidance, all four score descriptions, and the existing answers |
| Existing answers | included in the above | — |

Farmer/field context comes **for free** inside `GET /assessor/fields` —
`AssessorFieldEntry` already carries `farmer {id,name}`, `farm {id,name}`,
`field {id,name,crop,status,location,areaAcres}`, `program {id,name}`. The assessor
therefore does **not** need the farmer's farms/fields/monitoring data cached. Scope
stays tight.

---

## 4. Prefetch model

The assessor knows their route in advance far better than the farmer does. Design
the prefetch around that:

```
While online, on the work list:
   [ Download for offline ]  per field  (or "download all assigned fields")
        ↓
   1 × GET /assessor/programs/{p}/fields/{f}/summary
   C × GET /assessor/programs/{p}/fields/{f}/categories/{c}/questions
        ↓
   assessment_categories + assessment_questions + assessment_answers rows
   assessments row with status/progress
        ↓
   "Available offline ✓ (downloaded 2 h ago)" badge on the row
```

For a typical program (~8 categories) that is **9 requests per field**. Downloading
a day's route of 5 fields is ~45 requests — a few seconds on any connection, and
`assessment_questions` deduplicates across fields in the same program, so the
marginal cost per extra field is only the answers.

---

## 5. Offline capability verdict per step

| Step | Verdict | Notes |
|---|---|---|
| Login | ONLINE REQUIRED | |
| Session restore | FULLY OFFLINE after the bootstrap fix | Same fix as the farmer |
| Work list (`/assessor/fields`) | FULLY OFFLINE (cached) | Not paginated in the API wrapper — one call |
| Start a visit | ONLINE REQUIRED (recommendation A) | §2 |
| Open assessment summary | FULLY OFFLINE (prefetched) | |
| Browse categories | FULLY OFFLINE (prefetched) | |
| Read a question + score guidance | FULLY OFFLINE (prefetched) | |
| Save an answer (score + comment) | **FULLY OFFLINE** | Server upsert is idempotent |
| Attach evidence | PARTIALLY OFFLINE | Same redesign as the farmer (`07`, `11`) |
| Resume later | FULLY OFFLINE | `assessmentProgress.resumeByField` already persists an `assessor:` -prefixed key |
| Review screen | FULLY OFFLINE | Derive locally instead of calling `/review` |
| Submit | PARTIALLY OFFLINE | Queue it; server upsert makes replay safe |
| Compare with farmer answers | ONLINE REQUIRED | Out of scope; leave as is |
| Visit tracking / live GPS | ONLINE REQUIRED | Out of scope by nature |

---

## 6. What must synchronise later

Only three things, in this order per (program, field):

```
1. assessment_answers   → PUT  /assessor/.../questions/{q}/answer   (idempotent)
2. media uploads        → POST /assessments/evidence, then re-PUT the answer
3. assessment submit    → POST /assessor/.../submit                 (idempotent)
```

Plus, if option B is ever chosen, visit start/arrive/end — which is exactly why B
is not recommended.

Note that the assessor never creates farms or fields, so **the assessor path has no
local-id-to-server-id problem at all**: every id in every assessor URL is already a
server id from `/assessor/fields`. That makes the assessor the *simpler* of the two
roles to ship, despite the visit gate.

---

## 7. Conflict surface specific to the assessor

The server keeps farmer and assessor answers in separate rows —
`uq_assessment_responses_field_question_role_program` includes `author_role`. So an
assessor's offline answers **cannot** collide with the farmer's. The only realistic
assessor conflict is the same assessor editing the same answer from two devices, or
an admin locking/submitting the assessment while the assessor was offline. See `10`.
