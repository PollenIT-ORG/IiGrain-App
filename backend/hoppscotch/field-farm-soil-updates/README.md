# Field / Farm / Soil / Assessment updates (React Native dev)

Base URL: `http://localhost:5000/api/v1`. All routes need
`Authorization: Bearer <token>`. Six related backend changes are covered below.

---

## 1. Farm: new optional "Business Entity" text field

Farm create/update now accept an optional `businessEntity` (string, max 200,
just the farmer's business name). Responses include `business_entity`.

```bash
# create (mobile)
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{ "name": "Green Acres", "areaAcres": 100, "businessEntity": "Green Agro Pvt Ltd" }' \
  http://localhost:5000/api/v1/farms/me/farms
```

It is fully optional - omit it or send `""` and nothing breaks. Farm responses
now carry `"business_entity": "Green Agro Pvt Ltd"` (or `null`).

---

## 2. Field: `status` (healthy/monitor/critical) removed

The field health `status` field is gone. It is no longer returned in any field
response and is no longer accepted in field create/update bodies. Remove it from
the create/edit field form and from any field display.

---

## 3. Soil: nutrient fields lock until the field is enrolled

No new API and nothing removed. The soil endpoints keep all fields, but now tell
you whether the nutrient inputs are unlocked.

- `GET /fields/:id/soil` now returns `{ soil, locked }`.
  - `locked: true`  -> the field is NOT yet enrolled in a started program; keep
    the nutrient inputs (pH, organic matter, nitrogen, phosphorus, potassium,
    moisture) hidden/disabled.
  - `locked: false` -> unlocked; show the edit popup with those fields.
- `PUT /fields/:id/soil` returns the same `{ soil, locked }`. If the field is
  locked and you send any nutrient field, it returns `403` with a message.
  `texture`, `notes`, `testedOn` are always editable.
- The field-details soil tab (`GET /fields/:id/details?tab=soil`) also returns
  `soilLocked: boolean`.

So: at field create/update, do NOT show pH..moisture (they are optional). On the
soil tab, read `locked`; when `false`, the edit button opens the popup that
`PUT`s those fields.

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:5000/api/v1/fields/$FIELD_ID/soil
# -> { "success": true, "data": { "soil": { ... } | null, "locked": true } }
```

---

## 4. Discard an in-progress assessment (before submit)

```bash
curl -X DELETE -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/v1/assessments/my/programs/$PROGRAM_ID/fields/$FIELD_ID/discard
# -> { "data": { "field": { id, name }, "discardedAnswers": 12 } }
```

Clears all saved answers + the draft for that (field, program) so it can be
started fresh. If the assessment was already submitted -> `409` (cannot discard).

---

## 5. Reset + Delete for Fields and Farms

**Reset** clears the entity's editable data (keeps its name/identity; does not
touch assessments or soil). **Delete** is soft-delete, with guards.

### Farm (mobile)
```bash
curl -X POST   -H "Authorization: Bearer $TOKEN" http://localhost:5000/api/v1/farms/me/farms/$FARM_ID/reset
curl -X DELETE -H "Authorization: Bearer $TOKEN" http://localhost:5000/api/v1/farms/me/farms/$FARM_ID
```

### Field (mobile)
```bash
curl -X POST   -H "Authorization: Bearer $TOKEN" http://localhost:5000/api/v1/farms/$FARM_ID/fields/$FIELD_ID/reset
curl -X DELETE -H "Authorization: Bearer $TOKEN" http://localhost:5000/api/v1/farms/$FARM_ID/fields/$FIELD_ID
```

### Delete guards (both return `409` with a message)
- If a submitted assessment exists for the field (or any field of the farm) ->
  cannot delete.
- If the field (or any field of the farm) is enrolled in a program -> must be
  removed from the program first.

Show the returned `message` on `409`. Reset has no guards.

---

## 6. Farmer self-unenroll a field from a program

A farmer can remove one of their own fields from a program, gated by the
assessment state for that (field, program):

```bash
curl -X DELETE -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/v1/programs/$PROGRAM_ID/fields/$FIELD_ID/unenroll
```

- **Not started** (no answers saved) -> `200`, the field is removed from the
  program. Response: `{ data: { programId, fieldId, unenrolled: true, enrollmentRemoved } }`.
  `enrollmentRemoved` is `true` when that was the farmer's last field in the
  program (the whole enrollment is dropped).
- **In progress** (some answers saved, not submitted) -> `409`:
  "You have an assessment in progress for this field. Discard the assessment
  first, then unenroll the field." (Use the discard API in #4, then retry.)
- **Submitted** -> `409`: "You cannot unenroll this field because you have
  already submitted its assessment."

Other `409`/`404`: not enrolled in the program, or the field is not part of this
enrollment. This is farmer-only self-service; the admin unenroll
(`DELETE /programs/:id/enrollments/:enrollmentId`) removes the whole enrollment.

---

## 7. Enrolling unlocks soil + sends a notification

When a farmer enrolls (or adds fields to a program), they get an
`enrolled_in_program` notification whose body now says new fields are available
("...you can add soil details (pH, nutrients, moisture) for your field(s)."), and
the soil nutrient inputs for those fields become unlocked (see #3). No new call
needed - just react to the notification and re-check `GET /fields/:id/soil`
`locked`.
