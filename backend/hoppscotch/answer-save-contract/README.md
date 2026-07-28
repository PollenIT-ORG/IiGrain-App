# Saving an answer: how comment and photos are handled

Endpoint (farmer):

```
PUT /api/v1/assessments/my/programs/:programId/fields/:fieldId/questions/:questionId/answer
```

Endpoint (assessor):

```
PUT /api/v1/assessor/programs/:programId/fields/:fieldId/questions/:questionId/answer
```

Both behave the same way. The body is:

```json
{
  "score": 0,
  "comment": "optional text",
  "evidenceUrls": ["https://res.cloudinary.com/..."]
}
```

`score` is required (integer 0 to 3). `comment` and `evidenceUrls` are optional and
each one is treated independently.

## The rule for comment and evidenceUrls

The key idea: **leaving a key out is not the same as sending it empty.**

| What you send for a key | What happens to the stored value |
|---|---|
| key **absent** (not in the body) | left exactly as it was |
| `null` | cleared |
| `""` (comment) / `[]` (evidenceUrls) | cleared |
| a real value | overwritten with that value |

So:

- A **score-only** save must send just `{ "score": 2 }`. The previously saved
  comment and photos are kept. Do **not** send `comment: ""` or `evidenceUrls: []`
  on a score change unless you actually want to wipe them.
- To **clear** the comment, send `"comment": null` (or `""`).
- To **clear** the photos, send `"evidenceUrls": null` (or `[]`).
- Clearing one does not touch the other. `{ "score": 2, "comment": null }` leaves
  the photos untouched.

## Examples

Save everything:

```json
{ "score": 3, "comment": "Good cover", "evidenceUrls": ["https://res.cloudinary.com/demo/image/upload/v1/a.jpg"] }
```

Change only the score, keep comment and photos:

```json
{ "score": 2 }
```

Keep the score, clear just the comment:

```json
{ "score": 2, "comment": null }
```

Keep the score, clear just the photos:

```json
{ "score": 2, "evidenceUrls": null }
```

## Limits and validation

- `score`: integer, 0 to 3. Anything else returns 400.
- `comment`: up to 2000 characters.
- `evidenceUrls`: at most 5, and each must be a Cloudinary URL (uploaded through
  the evidence upload endpoint first).
- The field must be enrolled in an active program and the assessment must not be
  submitted yet, otherwise the save is refused with a clear message.

## Note

Earlier the API rejected `comment: null` and `evidenceUrls: null` with a 400. That
is fixed now - `null` is accepted and clears the value, matching the table above.
No app change is required for the accept side; this doc just describes the exact
contract so the clear-vs-keep behaviour is predictable.
