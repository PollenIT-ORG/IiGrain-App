# Program-Scoped Assessments - what changed (React Native dev)

This folder holds ONLY the endpoints that changed or are new for the
program-scoped assessments update. Import `program-scoped-assessments.json` into
Hoppscotch (and `environment.json` as the environment) to try them.

The full, unchanged API still lives in `../full-collection.json`.

---

## The one concept that changed

Before: a field was assessed **once**. Its answers/score were keyed by the field
alone.

Now: a field is assessed **once per program**. The key is **(field + program)**.
A field enrolled in 3 programs has 3 independent assessments: its own answers,
its own submission, its own score. One can be `in_progress` while another is
`submitted`.

So every assessment detail call now needs a `programId` **in the URL path**.

---

## What you have to change in the app

1. The two **list** endpoints keep the same URL but each item now includes a
   `program` object. Read `program.id` off the list item.
2. Pass that `program.id` into every detail call (summary, questions, save
   answer, review, history, submit, comparison, etc.).
3. A field can now appear multiple times in the list (once per program). Use
   `field.id` + `program.id` together as the row key, not `field.id` alone.

That is the whole migration. No request bodies changed. `saveAnswer` body is the
same (`score`, `comment`, `evidenceUrls`).

---

## List item shape (new `program` block)

`GET /assessments/my/fields` (farmer) and `GET /assessor/fields` (assessor) each
return items like:

```json
{
  "field":   { "id": "FIELD_ID", "name": "North Plot", "crop": "Wheat", "status": "active" },
  "farm":    { "id": "FARM_ID", "name": "Green Acres" },
  "program": { "id": "PROGRAM_ID", "name": "Kharif 2026" },
  "assessment": { "status": "in_progress", "answered": 4, "totalQuestions": 31, "percentage": 12.9, "submittedAt": null }
}
```

(The assessor item also has a `farmer` block, as before.)

---

## Endpoint changes (old -> new)

### Farmer

| Old | New |
|-----|-----|
| `GET /assessments/my/fields` | same URL (item now has `program{}`) |
| `GET /assessments/my/fields/:fieldId/summary` | `GET /assessments/my/programs/:programId/fields/:fieldId/summary` |
| `GET /assessments/my/fields/:fieldId/regen-index` | `GET /assessments/my/programs/:programId/fields/:fieldId/regen-index` |
| `GET /assessments/my/fields/:fieldId/categories/:categoryId/questions/list` | `.../my/programs/:programId/fields/:fieldId/categories/:categoryId/questions/list` |
| `GET .../:fieldId/categories/:categoryId/questions/:questionId` | `.../my/programs/:programId/fields/:fieldId/categories/:categoryId/questions/:questionId` |
| `GET .../:fieldId/categories/:categoryId/questions` | `.../my/programs/:programId/fields/:fieldId/categories/:categoryId/questions` |
| `PUT .../:fieldId/questions/:questionId/answer` | `PUT .../my/programs/:programId/fields/:fieldId/questions/:questionId/answer` |
| `GET .../:fieldId/review` | `GET .../my/programs/:programId/fields/:fieldId/review` |
| `GET .../:fieldId/history` | `GET .../my/programs/:programId/fields/:fieldId/history` |
| `POST .../:fieldId/submit` | `POST .../my/programs/:programId/fields/:fieldId/submit` |

`GET /assessments/my/history?farmId=<id>` (completed list) keeps its URL and now
returns one entry per (field, program), each with a `program` block.

### Assessor

| Old | New |
|-----|-----|
| `GET /assessor/fields` | same URL (item now has `program{}`) |
| `GET /assessor/fields/:fieldId/summary` | `GET /assessor/programs/:programId/fields/:fieldId/summary` |
| `GET /assessor/fields/:fieldId/categories/:categoryId/questions/list` | `.../programs/:programId/fields/:fieldId/categories/:categoryId/questions/list` |
| `GET .../:fieldId/categories/:categoryId/questions/:questionId` | `.../programs/:programId/fields/:fieldId/categories/:categoryId/questions/:questionId` |
| `GET .../:fieldId/categories/:categoryId/questions` | `.../programs/:programId/fields/:fieldId/categories/:categoryId/questions` |
| `PUT .../:fieldId/questions/:questionId/answer` | `PUT .../programs/:programId/fields/:fieldId/questions/:questionId/answer` |
| `GET .../:fieldId/review` | `GET .../programs/:programId/fields/:fieldId/review` |
| `POST .../:fieldId/submit` | `POST .../programs/:programId/fields/:fieldId/submit` |
| `GET .../:fieldId/farmer-assessment` | `GET .../programs/:programId/fields/:fieldId/farmer-assessment` |
| `GET .../:fieldId/comparison` | `GET .../programs/:programId/fields/:fieldId/comparison` |

### Admin (for reference)

| Endpoint | Change |
|----------|--------|
| `GET /programs/:id/assessment-progress` | NEW - `{ totalFields, farmerSubmitted, assessorSubmitted, farmerPct, assessorPct }` |
| `GET /programs/:id/enrollments/:enrollmentId/assessments` | now returns that program's assessment only (no cross-program bleed) |
| `GET /fields/:id/assessment-comparison` | now accepts optional `?programId=`; defaults to the field's latest live enrollment |

---

## Errors to expect

- Non-UUID `programId` / `fieldId` -> `400`.
- Field not enrolled in that program (or, for an assessor, not assigned to them
  in that program), or a program that has not started yet -> `404 Field not
  found.`
- Saving an answer after that (field, program) assessment is submitted -> `403`.

---

## Try it in Hoppscotch

1. Import `environment.json` (Environments -> Import) and select it.
2. Import `program-scoped-assessments.json` (Collections -> Import -> Hoppscotch).
3. Log in with the main collection's **Auth -> Login** first so `token` is set.
4. Run **Farmer (program-scoped) -> List my fields** - its test script auto-saves
   `programId` and `fieldId` from the first card. Then run the rest of the folder
   top to bottom. (Set `categoryId` / `questionId` from the category/question
   calls, same as before.)
5. The **Assessor** folder works the same way after logging in as an assessor.
