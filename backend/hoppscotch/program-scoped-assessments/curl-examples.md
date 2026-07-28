# Program-Scoped Assessments - API reference (mobile)

Assessments are now scoped to a **(field + program)** pair. The same field
enrolled in several programs is assessed once per program, each with its own
answers, submission and score.

Every assessment detail route now carries a `programId` in the path. The two
**list** routes are unchanged in URL but each item now also returns
`program.id` and `program.name`; read `program.id` off the list item and pass it
into the detail routes.

Base URL in examples: `http://localhost:5000/api/v1`. All routes need
`Authorization: Bearer <token>`.

---

## Farmer flow

### 1. List my assessable fields (one card per field + program)

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/v1/assessments/my/fields
```

Each item now includes:

```json
{
  "field": { "id": "...", "name": "North Plot", "crop": "Wheat", "status": "active" },
  "farm": { "id": "...", "name": "Green Acres" },
  "program": { "id": "PROGRAM_ID", "name": "Kharif 2026" },
  "assessment": { "status": "in_progress", "answered": 4, "totalQuestions": 31, "percentage": 12.9, "submittedAt": null }
}
```

A field in 3 programs appears as 3 cards with the same `field.id` but different
`program.id`.

### 2. Assessment summary (categories + progress)

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/v1/assessments/my/programs/$PROGRAM_ID/fields/$FIELD_ID/summary
```

### 3. Regen health index (per field + program)

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/v1/assessments/my/programs/$PROGRAM_ID/fields/$FIELD_ID/regen-index
```

### 4. Category question list / questions / one question

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/v1/assessments/my/programs/$PROGRAM_ID/fields/$FIELD_ID/categories/$CATEGORY_ID/questions/list

curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/v1/assessments/my/programs/$PROGRAM_ID/fields/$FIELD_ID/categories/$CATEGORY_ID/questions

curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/v1/assessments/my/programs/$PROGRAM_ID/fields/$FIELD_ID/categories/$CATEGORY_ID/questions/$QUESTION_ID
```

### 5. Save an answer

```bash
curl -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{ "score": 2, "comment": "Cover crop in place", "evidenceUrls": [] }' \
  http://localhost:5000/api/v1/assessments/my/programs/$PROGRAM_ID/fields/$FIELD_ID/questions/$QUESTION_ID/answer
```

### 6. Review (before submit)

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/v1/assessments/my/programs/$PROGRAM_ID/fields/$FIELD_ID/review
```

### 7. Submit

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/v1/assessments/my/programs/$PROGRAM_ID/fields/$FIELD_ID/submit
```

### 8. History (submitted only, per program)

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/v1/assessments/my/programs/$PROGRAM_ID/fields/$FIELD_ID/history
```

`GET /assessments/my/history?farmId=<id>` (completed list) is unchanged in URL
and now returns one entry per (field, program) with a `program` block.

---

## Assessor flow

`GET /assessor/fields` is unchanged in URL; each item now carries
`program.id` / `program.name`. Use that `program.id` below.

```bash
# List
curl -H "Authorization: Bearer $TOKEN" http://localhost:5000/api/v1/assessor/fields

# Summary
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/v1/assessor/programs/$PROGRAM_ID/fields/$FIELD_ID/summary

# Category question list / questions / one question
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/v1/assessor/programs/$PROGRAM_ID/fields/$FIELD_ID/categories/$CATEGORY_ID/questions/list
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/v1/assessor/programs/$PROGRAM_ID/fields/$FIELD_ID/categories/$CATEGORY_ID/questions
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/v1/assessor/programs/$PROGRAM_ID/fields/$FIELD_ID/categories/$CATEGORY_ID/questions/$QUESTION_ID

# Save answer
curl -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{ "score": 3, "comment": "Verified on site", "evidenceUrls": [] }' \
  http://localhost:5000/api/v1/assessor/programs/$PROGRAM_ID/fields/$FIELD_ID/questions/$QUESTION_ID/answer

# Review / Submit
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/v1/assessor/programs/$PROGRAM_ID/fields/$FIELD_ID/review
curl -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/v1/assessor/programs/$PROGRAM_ID/fields/$FIELD_ID/submit

# Farmer's assessment (read-only) + side-by-side comparison
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/v1/assessor/programs/$PROGRAM_ID/fields/$FIELD_ID/farmer-assessment
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/v1/assessor/programs/$PROGRAM_ID/fields/$FIELD_ID/comparison
```

---

## Admin (progress tracking)

Per-program rollup - how many enrolled fields have a submitted farmer / assessor
assessment:

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/v1/programs/$PROGRAM_ID/assessment-progress
# -> { "totalFields": 12, "farmerSubmitted": 7, "assessorSubmitted": 3,
#      "farmerPct": 58.3, "assessorPct": 25 }
```

Per-enrollment field status (already program-aware):

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/v1/programs/$PROGRAM_ID/enrollments/$ENROLLMENT_ID/assessments
```

The admin field-detail comparison accepts an optional `?programId=` (defaults to
the field's latest live enrollment):

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:5000/api/v1/fields/$FIELD_ID/assessment-comparison?programId=$PROGRAM_ID"
```

---

## Errors

- A `programId` / `fieldId` that is not a valid UUID -> `400`.
- A field that is not enrolled in that program (or, for an assessor, not assigned
  to them in that program), or a program that has not started -> `404 Field not
  found.`
- Saving an answer after the (field, program) assessment is submitted -> `403`.
