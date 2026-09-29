# 07 — Assessment Offline Design

Covers both roles. This is the highest-value offline feature in the app and also
the one with the best odds of working correctly, because of two properties the
current backend already has.

---

## 1. The two properties that make this feasible

### 1.1 Saving an answer is idempotent

`backend/src/models/assessmentMobile.model.ts:678`:

```sql
INSERT INTO assessment_responses
  (field_id, question_id, score, comment, evidence_urls, author_role, author_id, program_id)
VALUES (...)
ON CONFLICT (field_id, question_id, author_role, program_id) WHERE deleted_at IS NULL
  DO UPDATE SET score = EXCLUDED.score, ... , updated_at = now()
RETURNING ...
```

Backed by `uq_assessment_responses_field_question_role_program`
(`migrations/025_program_scoped_assessments.sql:45`).

**Consequence:** replaying a queued answer any number of times produces exactly one
row with the last value. No duplicate risk, no idempotency key needed, no backend
change. This is the strongest technical argument for doing assessments first.

### 1.2 Submitting is idempotent too

`assessmentMobile.model.ts:878` — `INSERT INTO field_assessments … ON CONFLICT
(field_id, author_role, program_id) DO UPDATE SET status='submitted', …`.
Replaying a submit re-computes and re-stamps; it does not create a second
assessment. (`submitted_at` is reset to `now()` on each replay — cosmetically
imperfect, functionally safe.)

---

## 2. Is the question data static or dynamic?

**Dynamic — fetched from the backend.** There is no bundled question set. (The
`src/data/assessment*Dummy.ts` files exist but are imported by nothing except the
dead `services/assessmentRepository.ts`.)

But the important detail is *what the question payload is scoped to*.
`backend/src/services/assessmentMobile.service.ts:420` (`getFieldCategoryQuestions`)
builds each question from `assessment_questions` rows selected by
`categoryId`; `fieldId` and `programId` only decide which **answers** get joined on.

So:

```
question text, guidance, score0..score3 descriptions   → per (program, category)
answerScore, answerComment, answerEvidenceUrls, answered → per (field, role)
```

That means the template is cached **once per program**, not once per field. A farm
with 30 enrolled fields caches ~80 question rows, not 2400.

> Verify this with one API diff before relying on it (`14`, Phase 6): fetch the same
> category for two different fields in the same program and confirm the non-answer
> fields are byte-identical.

---

## 3. What must be cached before going offline

| Entity | Endpoint | Calls | SQLite table |
|---|---|---|---|
| Assessment work list | `/assessments/my/fields` (farmer) or `/assessor/fields` | 1 (paged for farmer) | `assessments` |
| Field assessment summary | `.../programs/{p}/fields/{f}/summary` | 1 per field | `assessments`, `assessment_categories` |
| Categories | included in the summary | 0 | `assessment_categories` |
| **Questions + score guidance + existing answers** | **`.../programs/{p}/fields/{f}/categories/{c}/questions`** | 1 per category per field | `assessment_questions`, `assessment_answers` |
| Program / field context | already in the work list | 0 | `programs`, `program_fields`, `fields` |

**The bulk endpoint is the key discovery of this audit.**

* Farmer: `GET /assessments/my/programs/{p}/fields/{f}/categories/{c}/questions`
  (no `/list` suffix) — exists on the backend
  (`backend/src/routes/assessment.routes.ts:101` → `myFieldCategoryQuestions` →
  `getFieldCategoryQuestions`), returns full detail for every question in the
  category, and is **not present in `src/config/endpoints.ts` at all**.
* Assessor: the same shape is already declared as
  `Endpoints.assessor.categoryQuestionsFull` and is **never called**.

Without it, prefetching a 10-question category costs 11 requests (1 list + 10
details). With it, 1. Wiring these two endpoints is a small, self-contained,
**zero-backend-change** task and should be the first thing done in the assessment
phase.

---

## 4. Per-capability verdicts

| Capability | Verdict | Why |
|---|---|---|
| Download the assessment before going offline | **FULLY OFFLINE** | 1 + C requests per field, all GETs |
| Start an assessment offline | **FULLY OFFLINE** | "Starting" is not an API call — the first saved answer implicitly creates server state. There is no `POST /assessments` |
| Save answers offline | **FULLY OFFLINE** | idempotent upsert |
| Resume offline | **FULLY OFFLINE** | `assessmentProgress.resumeByField` already persists the pointer; answers come from SQLite |
| Validation offline | **FULLY OFFLINE** | All validation is client-side: `score !== null`, `locked`, `evidenceUploading`. There is no server validation round-trip while answering |
| Conditional questions | **N/A — none exist** | No branching logic anywhere in the payload. Every category returns a flat question list with a 0–3 score. This removes a whole class of offline problems |
| Progress / percentage | **FULLY OFFLINE (derivable)** | `assessmentSlice` already recomputes counters optimistically after each save; do the same from SQLite |
| Review screen | **FULLY OFFLINE (derivable)** | `GET /review` returns categories + questions + answers, all of which are already local. Derive it rather than calling |
| Submit offline | **PARTIALLY OFFLINE** | Queue it; idempotent server-side. The returned score/percentage is server-computed, so show "submitted, pending confirmation" until sync |
| Discard offline | **REQUIRES PRODUCT DECISION** | Destructive and replayed later could wipe answers made elsewhere in the meantime |
| Attach evidence offline | **PARTIALLY OFFLINE — needs redesign** | §5 |
| Locked assessments | works offline | `locked` is a boolean in the cached payload |

---

## 5. Evidence — the one real redesign

Current flow (`screens/assessment/shared/QuestionView.tsx`):

```
pick file → uploadEvidenceFile() → POST /assessments/evidence → returns URL
         → evidenceUrls: string[]
         → PUT .../answer { score, comment, evidenceUrls }
persist() refuses to run while evidenceUploading is true (line 230)
```

`SaveAnswerInput.evidenceUrls` is `string[]` of **server** URLs. There is no shape
in which a local file path can be sent. So offline, a question with a photo cannot
be saved at all today.

### Proposed offline model

```
pick file offline
   → copy into app-private storage           (media_files.file_path)
   → media_files row: upload_status='local'
   → assessment_answers saved immediately with the CURRENT evidence_urls
     (i.e. only the ones already uploaded — the local file is NOT in the array)
   → UI renders local + remote attachments together from media_files

on reconnect, per answer:
   1. upload each pending media  → POST /assessments/evidence → url
   2. media_files.remote_url = url, upload_status='uploaded'
   3. re-PUT the answer with the full evidenceUrls array
```

Two consequences to accept explicitly:

* An answer syncs **twice** when it has offline evidence: once with the score, once
  with the URLs. Both are idempotent, so this is safe — just not free.
* The `evidenceUrls` array must be **rebuilt from `media_files`** at flush time, not
  taken from the queued payload, or a second offline photo added later would be lost.

`buildAnswerPayload` already implements "only send `comment`/`evidenceUrls` when the
user actually touched them" (mirroring the backend's partial-update semantics at
`assessmentMobile.model.ts:683-691`). That behaviour must be preserved by the sync
engine, or a replayed score-only save will wipe photos.

---

## 6. Answers table: one JSON blob vs normalised rows

### Option A — one JSON document per assessment

```
assessments(local_id, …, answers_json TEXT)
```

| | |
|---|---|
| Resume | fine |
| Partial save | ✅ works, but rewrites the entire blob per keystroke-level save |
| Update one answer | requires read → parse → mutate → serialise → write |
| Large assessments | 80–200 answers with comments: a blob in the tens of KB rewritten on every save |
| Queries | none. "How many answers are pending sync across all fields?" needs a full scan + parse |
| Sync | **the killer** — the outbox needs per-answer granularity. One failed answer would either block the whole blob or force partial-blob bookkeeping, which is a JSON blob pretending to be rows |
| Conflict handling | whole-assessment last-write-wins; a single divergent answer poisons all of them |
| Migration | schema changes live inside the JSON, invisible to SQL migrations |
| Performance | write-amplified, no indexes |

### Option B — normalised rows

```
assessments        (local_id, program_id, field_local_id, author_role, status, …)
assessment_categories (program_id, category_id, name, total_questions)
assessment_questions  (question_id, program_id, category_id, text, guidance, score0..3)
assessment_answers    (local_id, assessment_local_id, question_id, score, comment,
                       evidence_urls_json, sync_status, updated_at_local, …)
```

| | |
|---|---|
| Resume | trivial — index on `(assessment_local_id, question_id)` |
| Partial save | one-row UPDATE |
| Update one answer | one-row UPDATE |
| Large assessments | linear, indexed |
| Queries | `WHERE sync_status='pending'` across everything; progress via `COUNT(*)` |
| Sync | **per-answer queue entries** — one bad answer fails alone; matches the server's per-answer PUT exactly |
| Conflict handling | per answer, using `updated_at_local` vs `server_updated_at` |
| Migration | ordinary `ALTER TABLE` |
| Performance | excellent at this scale |

### Recommendation: **Option B, normalised.**

The decisive argument is not performance — at 2400 rows either would be fast
enough. It is that **the sync unit is the answer**, because the API's write unit is
the answer (`PUT .../questions/{q}/answer`). A local model whose granularity does
not match the API's granularity forces the sync engine to invent one, and that is
where offline systems break.

One narrow exception: `evidence_urls_json` stays a JSON array inside the answer row.
It is a small, ordered, always-read-together list that the API itself sends as an
array — normalising it into a fourth table buys nothing. (Local, not-yet-uploaded
attachments do get their own rows, in `media_files`.)

`monitoring_records.values_json` is the same judgement call and lands the same way,
for a different reason: the form definition is client-side and module-specific, so
there is no stable column set to normalise into.
