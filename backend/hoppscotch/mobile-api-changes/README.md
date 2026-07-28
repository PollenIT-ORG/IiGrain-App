# Mobile API changes - what changed and what the app needs to do

This is a summary of the backend changes in this round that touch endpoints the
mobile app uses. It is written so the app does not break: for each change you
get what changed, why, and whether the app needs a code change or not.

**Nothing here changes the request/response envelope.** Every response is still:

```json
{ "success": true|false, "message": "human text", "code": "SOME_CODE", "data": {...}, "errors": [{ "field": "x", "message": "y" }] }
```

So the golden rule stays the same: on any failure, read `message` for the toast,
and read `errors[]` (when present) for field-level messages. If you already do
that, most of these changes need no app work.

---

## Quick view: does the app need changes?

| Change | App action |
|---|---|
| 1. Bad requests now return 400/404/409 instead of 500 | None if you already show `message`. Recommended: stop treating non-2xx as a generic crash. |
| 2. Deactivated / deleted account tokens are rejected mid-session | **Yes** - handle 401/403 by logging the user out cleanly. |
| 3. Rate limiting returns 429 (production only) | **Yes** - show `message`, do not retry in a loop. |
| 4. Impossible / backwards dates are rejected | None if you show `message`. Optional: validate on the form too. |
| 5. Soil nutrient bounds (0-100 for pH-adjacent percents) | None if you show `message`. Optional: match on the form. |
| 6. Soil lock message is now accurate (two cases) | None - just display whatever `message` comes back. |
| 7. Saving an answer: null clears, absent keeps | See the dedicated `answer-save-contract` README. |
| 8. Admin deletes a program -> the farmer's enrollment disappears | **Yes** - refresh lists / handle a field that is no longer enrolled. |
| 9. Marking a stale notification read now returns 404 | Minor - ignore a 404 here, do not surface it. |

---

## 1. Errors that used to be 500 are now proper 4xx

Before, some bad inputs crashed the request with `500 Internal Server Error` and
a raw database message. Now they come back as clean, typed errors:

- An invalid id in the URL (not a real UUID) -> `400 { message: "Invalid id." }`
- A value that fails a database rule (for example a duplicate) -> `409` with a
  readable message.
- A record that does not exist -> `404`.

**App action:** none required if you already display `message`. Please make sure
the app does not assume "non-2xx == app crashed / network error". Treat 400/404/
409 as normal, expected outcomes and show the message.

---

## 2. A deactivated or deleted account is rejected immediately (important)

Previously, if an admin deactivated or deleted a user, that user's existing login
token kept working until it expired (up to ~15 minutes). Now every authenticated
request re-checks the account, so the token stops working right away:

- Account deactivated -> `403 { code: "FORBIDDEN", message: "Your account has been deactivated. Contact an administrator." }`
- Account deleted -> `401 { code: "UNAUTHORIZED", message: "Your account is no longer available. Please sign in again." }`

**App action (required):** in your global response handler, when you get one of
these, log the user out and send them to the login screen with the message. Do
NOT try to refresh the token for these - a refresh will not fix a deactivated or
deleted account.

Suggested rule:
- `401` on any endpoint (except a token refresh you initiated) -> clear the
  session, go to login, show the message.
- `403` with the "deactivated" message -> same: clear session, go to login,
  show the message.

---

## 3. Brute-force protection returns 429 (production)

Login, verify-otp, reset-password, request-otp and register are now rate limited.
After too many attempts from the same client you get:

```
429 { code: "TOO_MANY_REQUESTS", message: "Too many failed sign-in attempts. Please wait a few minutes and try again." }
```

(The exact wording differs per endpoint - always show `message`.)

Note: rate limiting is OFF in local development (so testing is not blocked) and
ON in production. So you may never see a 429 locally, but the app must handle it
for production.

**App action (required):** on `429`, show `message` and stop. Do not auto-retry
in a loop - that only extends the block.

---

## 4. Dates are validated properly

For creating or editing a field, `sowingDate` and `expectedHarvest`:

- Must be a real calendar day. `"2026-99-99"` or `"2026-02-30"` now return
  `400 { message: "Sowing date is not a real date." }`.
- `expectedHarvest` cannot be before `sowingDate` -> `400 { message: "Expected harvest cannot be before the sowing date." }`.

Format is unchanged: `YYYY-MM-DD`.

**App action:** none if you show `message`. Optional but nicer: block these on the
form so the user gets instant feedback.

---

## 5. Soil number ranges

When saving soil (`PUT /fields/:id/soil`), the accepted ranges are now:

- `ph`: 0 to 14
- `organicMatter`: 0 to 100 (percent)
- `moisture`: 0 to 100 (percent)
- `nitrogen`, `phosphorus`, `potassium`: 0 and up (ppm, with a high safety cap)

Out-of-range values return `400` with a clear message naming the field.

**App action:** none if you show `message`. Optional: mirror these limits on the
soil form.

---

## 6. Soil "locked" message is now accurate

Soil nutrient fields unlock only while the field is enrolled in an active program.
Before, the locked message always said "enroll this field", even when the field
WAS enrolled but the program had ended. Now the message tells the truth:

- Field never enrolled -> "Soil nutrient values ... can only be entered once this
  field is enrolled in an active program."
- Field enrolled but the program is closed / ended -> "This field's program is
  closed or has ended, so its soil nutrient values are locked. They can only be
  edited while the program is open."

The `locked` boolean in the soil response is unchanged. **App action:** none -
just display the `message` you get on a rejected save. Do not hard-code the old
wording anywhere.

---

## 7. Saving an answer (null vs absent vs value)

The save-answer endpoints now accept `comment: null` and `evidenceUrls: null`
(they used to reject null with a 400). null clears the value; an absent key keeps
it; a value overwrites it. Full details and examples are in the separate
`answer-save-contract` README - please read that one, it is the important one for
the assessment screen.

---

## 8. When an admin deletes a program, its enrollments go with it

Deleting a program now also removes its enrollments (this fixes an old bug where a
field could get permanently stuck). A program that has any submitted assessment
cannot be deleted at all (the admin must set it inactive instead), so submitted
work is never lost.

What this means for the app: a program the farmer was enrolled in can disappear,
which means one of their fields may stop being enrolled.

**App action (recommended):** after actions that could be affected, re-fetch the
farmer's program / field lists rather than trusting cached enrollment state. If
the app opens an assessment for a field whose program was removed, the endpoints
will return a normal `404`/`409` with a message - handle it by sending the user
back to the list and refreshing.

---

## 9. Marking a missing notification read returns 404

`PATCH /notifications/:id/read` used to return `200` even for a notification that
does not exist or belongs to someone else. It now returns `404` in that case.
Marking an already-read notification is still fine (idempotent 200).

**App action:** minor. If you mark-read on a stale id and get a 404, just ignore
it (do not show an error toast). The unread badge still updates from the list.

---

## Things that did NOT change

- The response envelope (`success`, `message`, `code`, `data`, `errors`).
- Auth flow: login / register / verify-otp / refresh / forgot / reset all work
  the same way and return the same shapes.
- Field, farm, assessment, program, visit, notification and profile response
  shapes are unchanged.
- Pagination shape (`meta.page`, `meta.limit`, `meta.total`, `meta.totalPages`)
  is unchanged. Only the wording of out-of-range errors got friendlier.

If anything here is unclear or you want an exact request/response example for a
specific screen, ask and it can be added.
