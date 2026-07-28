# Notification redirect (React Native dev)

Every notification now carries a `redirect` object so you know exactly which
screen to open when the user taps it. It is present on:
- `GET /notifications` (each item in `data.notifications[]`)
- the realtime socket event `notification:new` (the pushed payload)

You do NOT have to parse `data` yourself for routing - just read `redirect`.

---

## Shape

```json
{
  "id": "...",
  "type": "assessment_submitted",
  "title": "Assessment submitted",
  "body": "Your assessment for \"North Plot\" was submitted (72.5%).",
  "data": { "fieldId": "...", "programId": "...", "screen": "assessment_history" },
  "redirect": {
    "screen": "assessment_history",
    "fieldId": "FIELD_ID",
    "programId": "PROGRAM_ID"
  },
  "read": false,
  "created_at": "2026-07-20T..."
}
```

- `redirect.screen` is a stable string key - map it to one of your screens.
- The other keys (`fieldId`, `programId`, `enrollmentId`, `visitId`) are the nav
  params, present only when relevant. Anything absent just is not needed.

---

## Screen keys and their params

| `screen` | Sent for | Params you get | Open |
|----------|----------|----------------|------|
| `available_programs` | a new program is available | `programId` | the programs-to-enrol list (optionally deep-link the program) |
| `my_assessments` | enrolled in a program / fields added / assessor assigned | `programId`, `enrollmentId` | the farmer's assessment list |
| `assessment_history` | the farmer's own assessment was submitted | `programId`, `fieldId` | that field's submitted assessment (program-scoped history) |
| `assessor_field_assessment` | a farmer submitted (notice to the assessor) | `programId`, `fieldId` | the assessor's assessment screen for that field |
| `assessment_comparison` | a submission (notice to admins) | `programId`, `fieldId` | the farmer-vs-assessor comparison |
| `visit_tracking` | an assessor started a visit | `visitId`, `fieldId` | the live visit-tracking screen |
| `notifications` | fallback when nothing specific applies | (none) | just the notifications list |

The exact screen names are yours - `screen` is only a key. Suggested mapping:

```ts
function routeForNotification(n) {
  const r = n.redirect;
  switch (r.screen) {
    case "available_programs":        return ["Programs"];
    case "my_assessments":            return ["MyAssessments", { programId: r.programId }];
    case "assessment_history":        return ["AssessmentHistory", { programId: r.programId, fieldId: r.fieldId }];
    case "assessor_field_assessment": return ["AssessorAssessment", { programId: r.programId, fieldId: r.fieldId }];
    case "assessment_comparison":     return ["Comparison", { programId: r.programId, fieldId: r.fieldId }];
    case "visit_tracking":            return ["VisitTracking", { visitId: r.visitId, fieldId: r.fieldId }];
    default:                          return ["Notifications"];
  }
}
```

---

## Notes

- Older notifications created before this change still get a sensible `redirect`
  (the default screen for their `type` plus whatever ids they stored), so you can
  rely on `redirect` always being present.
- `redirect.screen` will never be missing; worst case it is `"notifications"`.
