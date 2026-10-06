# Enrollment ID — mobile implementation

Implements `MOBILE-ENROLLMENT-ID-CHANGES.md` (backend spec, already live on the
API). No server change was needed or made; everything below is app side.

## The rule, restated

An Enrollment ID belongs to **one farmer and one program**, issued when the
office accepts that program's survey submission.

- No survey → no Enrollment ID.
- No Enrollment ID → **no registration**, and **no enrolling** in that program.
- One account per email. A second program means enrolling again, never
  registering again.
- Format `IIG-YYYY-NNNNNN`, e.g. `IIG-2026-482913`.

---

## 1. Registration

### The field

`Enrollment ID*` is the **first** field on the signup form — it is what makes an
account possible at all, so it frames the form rather than trailing it.

| Behaviour | Detail |
|---|---|
| Input | `autoCapitalize="characters"`, `autoCorrect={false}`, `maxLength={32}` |
| Live formatting | Upper-cased, spaces stripped, dashes re-grouped as `IIG-2026-482913` while the value still looks like `IIG` + digits |
| Other formats | Left exactly as typed — only case and spaces are touched |
| Client validation | Required, max 32 characters. **Nothing else** — the server owns existence, and a shape guess would lock out a valid ID |
| Sent as | `enrollmentId`, trimmed + upper-cased, in `POST /auth/register` |

The dash grouping strips and re-inserts rather than appending, which is what
stops backspace from getting stuck on a dash the formatter would put straight
back. Covered by `__tests__/enrollmentId.test.ts`.

### The hint line

One quiet line under the field, and it changes with what has been typed:

| State | Line |
|---|---|
| Empty | "Sent to you by email when your survey was accepted." |
| Canonical shape | ✓ "That looks like a valid Enrollment ID." (green) |
| Anything else | "Most IDs look like IIG-2026-123456. Enter yours exactly as sent." |

The email field carries one too — "Use the address your Enrollment ID was sent
to" — which heads off the mismatch error before it happens.

### Where the errors land

Registration fires from the **Role** screen (step 2), while the field lives on
the **signup** screen (step 1). So a rejection is shown on the Role screen as a
notice with the action that fixes it, and that action carries the message back
to the field.

| Server message | Code | Notice | Action |
|---|---|---|---|
| `Enrollment ID is required.` | `ENROLLMENT_ID_REQUIRED` | warning | Check my Enrollment ID → signup, message under the field |
| `That Enrollment ID was not found…` | `ENROLLMENT_ID_NOT_FOUND` | warning | Check my Enrollment ID → signup, message under the field |
| `That Enrollment ID belongs to a different email address…` | `ENROLLMENT_ID_EMAIL_MISMATCH` | warning | Edit my details → signup |
| `You are already registered. Please log in instead.` | `ALREADY_REGISTERED` | **info, not red** | **Go to login** (+ "Use a different email") |
| anything else | fallback | danger | message only |

The already-registered case is expected behaviour — it is what a farmer joining
their second program hits — so it is toned as information and leads straight to
login, exactly as the spec asks.

Returning to signup uses `navigate(..., { pop: true })`: React Navigation v7
pushes a duplicate screen without it.

---

## 2. Programs list — two kinds of program

`GET /programs/my/available` now returns `can_enroll` and `survey_url`. The
Enroll Now screen splits on them instead of showing one mixed list, because the
two kinds need two different actions.

```
┌─ Ready to enroll ───────── 2 ─┐   can_enroll: true
│  Your Enrollment ID has been  │   → card opens the field-selection sheet
│  issued for these.            │     (unchanged flow)
└───────────────────────────────┘

┌─ Open for applications ── 3 ─┐    can_enroll: false
│  Take the survey to get an   │    → "Survey required" chip + external-link icon
│  Enrollment ID for these.    │    → card opens survey_url in the browser
└──────────────────────────────┘
```

- Section headers and their explanatory line appear **only when both kinds are
  present** — with one kind there is nothing to distinguish, so the screen stays
  quiet.
- The hero copy follows the same rule: "Join a program to begin" when something
  is enrollable, "Apply to get started" when everything still needs a survey.
- `survey_url: null` → the card is not pressable and reads "Applications are not
  open yet". No button to an empty link, per the spec.
- `survey_url` is validated as `http(s)` when mapped; anything else becomes
  `null`.
- **A program the farmer is already enrolled in always stays enrollable**
  (`can_enroll || already_enrolled`), because that sheet is also the only way to
  *remove* a field. Access is never pulled from under them.
- If a server ever omits `can_enroll` entirely, it defaults to `true` — the old
  behaviour — and the server still rejects what it disagrees with.

---

## 3. Enrolling — unchanged, plus one defence

No Enrollment ID field was added to the enrollflow; the server matches the
logged-in farmer's ID itself.

The new `400 Please complete this program's survey first.` is handled anyway,
for the farmer who had the sheet open while their standing changed:

1. Sheet closes.
2. A dialog shows the server's message, with **Take survey** when the program has
   a `survey_url` (otherwise just OK).
3. `Tags.programs` is invalidated, so the list refetches and that card flips to
   "Apply" by itself.

Every other enrollfailure keeps its existing toast.

---

## 3b. Enroll Now — refresh, freshness and the empty sheet

Three fixes that came out of testing the screen.

**Pull to refresh.** The programs list (and the "no programs" state) now pulls to
refresh. It refetches the programs, and the fields too if they have already been
loaded. This is the only *manual* fetch on the screen.

**The sheet was showing stale fields.** The available-programs payload embeds
each program's own field list, and `sheetFields` prefers it over the global
enrollable-fields list. Creating a farm or a field invalidated `farms`,
`dashboard` and `enrollable-fields` — but **not** `programs` — so a field added
from the Farms tab did not appear in the sheet until the 5-minute TTL expired.
`Tags.programs` is now part of both the local write invalidation
(`WRITE_INVALIDATIONS` → `FARM_SHAPE_TAGS`) and the socket one
(`tagsForSync` → `field` / `farm`), so the two cannot drift apart.

**"Go to Farms" left the sheet open.** It is a native `Modal`, which keeps
rendering above everything even after the screen loses focus — so tapping it
parked an "add a field" sheet on top of the Farms screen the farmer had just
been sent to, and it looked like the app was still asking them to create a farm
they had already created. The sheet now closes before navigating.

**The empty sheet says what is actually missing**, in three cases:

| What we know | Copy | Action |
|---|---|---|
| They have farms | "No fields to enroll" — your farms have no fields left to enroll | Add a field |
| They have none, and we have loaded a list to prove it | "No farms yet" — create a farm and add a field to it | Create a farm |
| Neither list loaded yet | "Nothing to enroll yet" — you need a farm with at least one field | Go to Farms |

The farm counts are read from whatever the Home dashboard and the Farms tab have
already loaded. **Nothing is fetched to produce this copy.**

### Fetching, precisely

Nothing on this screen refetches because of navigation. Both lists go through
`useSyncedFetch`, which runs only when the screen is focused **and** either a tag
it depends on was invalidated or its 5-minute TTL has passed.

Enrollable fields go one step further: they are now `enabled: sheetOpen`, so they
are fetched the first time the sheet is opened rather than when the screen mounts
— that request walks every page of `/programs/my/fields`, up to twenty calls, and
a farmer who only browses the list never needed it. Reopening the sheet uses the
cache unless a farm/field write invalidated it.

---

## 4. Existing farmers

Nothing to do. The backfill gave every enrolled farmer an ID per program, and an
ID is only needed to *register* — which they already have.

---

## Files changed

| File | Change |
|---|---|
| `src/utils/enrollmentId.ts` | **new** — normalize, live format, shape check |
| `src/utils/openExternalUrl.ts` | **new** — http(s)-only browser opener with a toast on failure |
| `src/components/feedback/NoticeCard.tsx` | **new** — tone-aware outcome card with up to two actions |
| `src/components/Input/Input.tsx` | `hint` + `hintTone` (muted / success / warning); never shown next to an error |
| `src/components/AppIcon/iconRegistry.ts` | `ID_CARD`, `TICKET`, `SURVEY`, `OPEN_IN_NEW` |
| `src/utils/fieldValidators.ts` | `enrollmentIdValidator` |
| `src/api/authApi.ts` | `RegisterPayload.enrollmentId`, normalized on send |
| `src/api/enrollmentApi.ts` | maps `can_enroll` / `survey_url` (snake **and** camel) |
| `src/types/enrollment.ts` | `AvailableProgram.canEnroll`, `.surveyUrl` |
| `src/config/errorMessages.ts` | 5 new codes + message rules |
| `src/navigation/navigationTypes.ts` | `Role.enrollmentId`, `Authentication.enrollmentError` |
| `src/screens/auth/components/SignupForm.tsx` | the field, the hint, the returned error |
| `src/screens/auth/AuthenticationScreen.tsx` | re-applies `mode` when route params change |
| `src/screens/auth/RoleScreen.tsx` | sends `enrollmentId`; per-code recovery notice |
| `src/screens/enroll/EnrollNowScreen.tsx` | two sections, two card states, survey open, defensive 400, pull to refresh, lazy field fetch, accurate empty copy |
| `src/components/enroll/FieldSelectSheet.tsx` | `emptyState` prop replaces the hard-coded empty block (and `onGoToFarms`) |
| `src/redux/syncTags.ts`, `src/redux/slices/syncSlice.ts` | farm/field writes now also invalidate `programs` |
| `src/redux/slices/dashboardSlice.ts` | `selectDashboardFarmsLoaded` — lets an empty list mean "no farms", not "not loaded" |

Tests: `__tests__/enrollmentId.test.ts` (formatting rules),
`__tests__/enrollmentErrors.test.ts` (server message → code, including when the
backend also sends a generic `BAD_REQUEST` / `CONFLICT` code).

`npx tsc --noEmit` and `npx jest` both pass.

---

## QA checklist

**Signup**
- [ ] Continue with an empty ID → "Enrollment ID is required" under the field
- [ ] Type `iig2026482913` → becomes `IIG-2026-482913`, hint turns green
- [ ] Backspace through the whole value → no dash gets stuck
- [ ] Paste `iig-2026-123456 ` (trailing space) → accepted
- [ ] Type an ID in some other format → left as typed, still submittable

**Registration outcomes** (Role screen → Create Account)
- [ ] Unknown ID → warning notice, "Check my Enrollment ID" returns to signup with the message under the field and the keyboard on it
- [ ] ID issued to another email → "Edit my details"
- [ ] Already registered → **info** notice, "Go to login" lands on the login form
- [ ] Valid ID → OTP screen as before

**Programs**
- [ ] `can_enroll: true` → Enroll card, field sheet opens
- [ ] `can_enroll: false` + URL → "Survey required" chip, card opens the browser
- [ ] `can_enroll: false`, `survey_url: null` → muted, not pressable
- [ ] Both kinds present → two sections with counts; one kind → single title
- [ ] Already-enrolled program stays in the enroll section
- [ ] Force the enroll400 → dialog with "Take survey", list refreshes to "Apply"
- [ ] Pull down on the list → refreshes; pull down on "No programs available" → refreshes
- [ ] Open the sheet with no fields → tap the action → **sheet closes** and the Farms tab appears
- [ ] Create a farm, return, reopen the sheet → copy has changed to "No farms yet" → "Add a field"
- [ ] Add a field, return, reopen the sheet → **the new field is listed**
- [ ] Switch tabs back and forth → no repeated `/programs/my/available` calls in the network log
- [ ] Never open the sheet → `/programs/my/fields` is never called

---

## One thing to confirm with the backend

The spec makes `enrollmentId` required for `POST /auth/register`, and the app
now sends it for **every** role — including `assessor` and `program_partner`,
who are picked on the next screen and are unlikely to hold a program Enrollment
ID. It is implemented exactly as specified. If non-farmer roles are meant to
register without one, the role would have to move ahead of the field in the flow
(or the server would have to exempt them) — worth a word with the backend dev
before the next release.
