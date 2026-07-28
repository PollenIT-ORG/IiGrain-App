# iiGrain - Assessor Experience · Build Guide

> A complete, self-contained brief to build the **Assessor** role experience inside the existing iiGrain React Native app (`c:\farmer-app\application`). It is grounded in the *real* codebase and the *real* backend - follow it literally. A farmer-side design markup image accompanies this brief as the visual reference for tone, density, and component style; build the assessor screens to the **same design language**.

---

## 0. Mission (TL;DR)

iiGrain already ships a polished **Farmer** experience (Dashboard, Farms & Fields, field-scoped Assessment flow, Reports). You are adding the **Assessor** experience: a third-party evaluator who is assigned to farmers and **conducts their own independent assessment of a farmer's field** - using the **exact same assessment form the farmer uses** (categories → questions → score 0-3 + comment + evidence) - then **submits it**. The assessor's submission is a **brand-new, separate assessment of that field**, fully independent of whether the farmer assessed it or not. **On submit it is complete** - there is **no admin review / sign-off step**; submitting finalizes (locks) the assessor's assessment. Build it as a **role-gated branch of the same app** (same login; after auth, role decides which tab stack shows). Match the existing design system and architecture exactly - a reviewer should not be able to tell the farmer and assessor modules were built by different people.

---

## 1. Non-negotiable rules

1. **NEVER change the backend** (`c:\farmer-app\backend`). It is read-only. Read it to learn contracts; never edit it.
2. **Match the design system.** Use the tokens in `src/constants/*` (`COLORS`, `spacing`, `presets`, `borderRadius`, `borderWidth`, `shadows`) and the helpers in `src/utils` (`scale`, `moderateScale`, `addAlpha`, `formatDate`, `formatNumber`). **Never hardcode hex, font sizes, or raw pixels.**
3. **Reuse before you build.** The component catalog (§6) covers ~90% of the UI. Only build a new component when nothing fits, and put it in `src/components/<Name>/` with a barrel + style file, matching the existing folder pattern.
4. **Follow the layered architecture** (§5) - raw wire types → pure mappers → domain models → thunks → slices → screens. No `any`. TypeScript strict.
5. **Typecheck must stay clean.** Run `npx tsc --noEmit`. The only pre-existing errors are two `gray200` references in `FieldDetailsScreenStyle.ts` - ignore those, introduce no new ones.
6. **Text everywhere uses `AppText` / `AppTextInput`** (never raw `<Text>`), per the project convention.
7. **No new native modules without flagging a rebuild.** Prefer JS-only solutions; reuse already-installed natives (`react-native-image-crop-picker`, `@react-native-community/datetimepicker`, vector-icons, reanimated).

---

## 2. Who the assessor is (domain model)

- **Role name:** `assessor` (confirmed in `backend/src/config/rbac.ts`). Hierarchy: `super_admin > admin > program_administrator > assessor / farmer`.
- An **org manager** (super_admin / admin / program_administrator) **assigns an assessor to a farmer** via `assessor_assignments`. One assignment = one assessor ↔ one farmer pair, with an optional `note` (e.g. "Quarterly soil-health visit").
- **The assessor's job:** open an assigned farmer → drill into that farmer's **farms → fields** → pick a field → **conduct a fresh, independent assessment of that field** using the **same form the farmer uses** (each category's questions, score 0-3 + comment + evidence) → **review → submit**. Submitting **finalizes (locks)** the assessor's assessment and marks it **complete - there is no admin review or sign-off**.
- **The assessor's assessment is a SEPARATE assessment of the field, not a review of the farmer's.** It is independent of, and coexists with, any farmer self-assessment of the same field:
  - The assessor fills **every** question themselves (it is *their* assessment), regardless of what the farmer answered. There is **no "skip the questions the farmer already did"** logic and **no farmer-answer comparison** on the question screen.
  - A field can therefore have **two assessments on record** - one "By Farmer" and one "By Assessor" - each its own submitted (locked) record, each stamped with the submitter's id + role. History/lists show both, distinguished by the submitter chip.
- Scores are the same **0-3 scale** used by farmers: `0 Conventional / No action`, `1 Awareness / Beginning`, `2 Developing / Implementing`, `3 Advanced / Regenerative`.

---

## 3. THE BACKEND REALITY - read this before designing data

I audited the backend. Here is exactly what exists and what does **not**. Do not invent endpoints; do not call ones that will 403.

### 3.1 What EXISTS and is callable by an assessor
- **Auth** (same as farmer): `POST /auth/login`, `POST /auth/refresh-token`, `GET /auth/me`, `GET /profile/me`. After login, the user object carries `role: "assessor"`. **This is your role-branch signal.**
- The assessor logs in identically to a farmer; the JWT + silent-refresh + global-error plumbing in `src/services/http.ts` already works for them.

### 3.2 What EXISTS but assessors CANNOT call (org-manager-gated)
- `POST/GET/DELETE /assessor-assignments` → guarded by `authorize("super_admin","admin","program_administrator")`. An assessor calling these gets **403**. They are the *admin* tools that create the assessor↔farmer link.
- The real assignment entity shape (from `assessorAssignment.model.ts`, useful so your dummy types match reality):
  ```ts
  PublicAssignment {
    id; assessor_id; assessor_name; assessor_email;
    farmer_id; farmer_name; farmer_email;
    assigned_by; org_id; note; created_at; updated_at;
  }
  ```

### 3.3 What does NOT exist yet (the gaps you must design around)
There is **no assessor-scoped endpoint** to:
- list "the farmers/fields assigned to *me* (the logged-in assessor)",
- read a farmer's farms/fields (read-only context) - the existing `/farms/me/...` routes are scoped to farms the caller **owns**, which an assessor does not,
- run the assessor's **own** field assessment (summary / categories / questions / save answer / submit) for a field they don't own - the existing `/assessments/my/fields/:fieldId/...` routes are owner-scoped.

**Consequence:** treat the assessor data exactly like the farmer module was *originally* built - against a clearly-isolated **dummy repository** typed to the eventual API contract, so it swaps to real endpoints later with **zero UI change** (see the comment in `src/types/farm.ts`: *"When the backend lands, these interfaces become the API response contract and the dummy data layer is swapped for real fetches with no UI change."*). Wire the **real** auth/profile; stub the rest behind the repository.

### 3.4 Proposed future contract (build your dummy layer + mappers to THIS shape)
The assessor flow is a **near-1:1 mirror of the farmer's own assessment endpoints** - the only difference is it's scoped to an *assigned* field instead of an *owned* one. So the assessor performs a **fresh, independent assessment** of the field with the same shape (summary → category questions → save answer (upsert) → review → submit). Clearly mark these as *proposed / not-yet-live* in code comments:
```
GET  /assessor/assignments?status=             → assignments for the logged-in assessor (+ farmer, counts, status)
GET  /assessor/farmers/:farmerId/farms         → that farmer's farms (read-only context)
GET  /assessor/farms/:farmId/fields            → that farm's fields (read-only context, + assessor-assessment status per field)
GET  /assessor/fields/:fieldId/summary         → MY (assessor) assessment summary for the field (mirror of farmer summary)
GET  /assessor/fields/:fieldId/categories/:categoryId/questions/list
GET  /assessor/fields/:fieldId/categories/:categoryId/questions/:questionId
                                               → the question + MY (assessor) saved answer (score, comment, evidenceUrls)
PUT  /assessor/fields/:fieldId/questions/:questionId/answer
                                               → UPSERT my answer { score: 0..3, comment, evidenceUrls } (same as farmer save-answer)
GET  /assessor/fields/:fieldId/review          → all categories/questions with MY answers (Review & Submit)
POST /assessor/fields/:fieldId/submit          → finalize/lock MY assessment (no admin review - submitting completes it)
```
> These intentionally have **no** `verdict`, no `verified/flagged`, no farmer-answer fields, and **no sign-off** - the assessor is authoring their own assessment, not reviewing the farmer's. The backend will likely implement them by reusing the existing farmer assessment service with an *assigned-field* authorization check instead of *owned-field*.

Also leave a short `BACKEND-GAPS.md` note (or a top-of-file comment) listing these so the backend team can implement them. **Do not implement them yourself.**

---

## 4. Design system (use the real tokens - do not hardcode)

Read and use, never duplicate:
- **`src/constants/colors.ts`** - `COLORS.primary`, `primaryDark`, `secondary`, `accent`, `info`, `success`, `warning`, `danger`, `gray900/700/500/300/100`, `white`, `overlay`. Status mapping the app already uses: healthy→success, monitor→warning, critical→danger.
- **`src/constants/typography.ts`** - `presets.heading*`, `labelMD/LG`, `inputLabel`, `inputText`, `bodySM/XS`, etc. The markup's scale is H1 28/Bold, H2 22/SemiBold, H3 18/SemiBold, Body 16/14, Caption 12 - already encoded in presets.
- **`src/constants/spacing.ts`** - 4px grid (`spacing[1]=4 … spacing[10]=40`), `borderRadius` (`md/lg/xl/full`), `borderWidth` (`hairline/thin/medium`).
- **`src/constants/shadows.ts`** - `shadows.sm/md/lg/xl`.
- **Icons:** `react-native-vector-icons/MaterialCommunityIcons`, outline style (e.g. `clipboard-check-outline`, `account-group-outline`, `map-marker-outline`, `calendar-outline`).

---

## 5. Architecture & conventions you MUST follow

Mirror the farmer module precisely (study `FarmApi.ts`, `farmThunks.ts`, `farmSlice.ts`, `FarmsScreen.tsx` as the canonical templates).

- **API layer** `src/api/AssessorApi.ts` (+ maybe `AssessorReviewApi.ts`): private raw `Raw*` interfaces (snake/camel as the wire returns), **pure synchronous mappers** that are the ONLY place wire→domain happens, and request functions that unwrap the `{ data }` envelope. Use the shared `http` from `src/services/http`. For the not-yet-live data, the "request function" reads from the dummy repository instead of `http`, but keeps the **same signature + return type**, so flipping to `http.get(...)` later is a one-line change.
- **Domain models** in `src/types/assessor.ts`.
- **Thunks** `src/redux/thunks/assessorThunks.ts`: `createAsyncThunk` with `try/catch → rejectWithValue(handleApiError(error))` and `ThunkConfig = { rejectValue: StandardizedError }`.
- **Slice** `src/redux/slices/assessorSlice.ts`: `extraReducers`, `loading/refreshing/error` + `creating/createError`-style flags, **structural selectors** (`interface HasAssessor { assessor: AssessorState }` - never import `RootState`), reset on `logout`. Register it in `src/redux/store.ts` (assessor data need not be persisted).
- **Screens** in `src/screens/assessor/`, one `*Screen.tsx` + `*ScreenStyle.ts` each. Use `useAppDispatch/useAppSelector`, `AppScreenProps<...>`, `KeyboardAwareScrollView` for forms, `RefreshControl` for lists, loading/error/empty states exactly like `FarmsScreen`/`FarmDetailsScreen`.
- **Errors:** rejected thunks already surface the global error modal via the http interceptor - screens just avoid navigating on failure and use `showSuccess(...)` on success (see `EditProfileScreen`).
- **Validation:** `useFormValidation` + `src/utils/fieldValidators.ts` for any forms (e.g. the per-question comment field, same as the farmer's).

---

## 6. Component & util catalog to reuse

From `src/components/index.ts`: `AppText`, `AppTextInput`, `Input`, `Button` (variants primary/secondary/tertiary; `loading`, `leftIcon`, `fullWidth`), `AppHeader` (`variant="title"|"back"`, `showDrawer`, `rightActions`), `AppDropdown`, **`AppDatePicker`** (themed; emits `YYYY-MM-DD`), `AppPhoneInput`, `OtpInput`, `AnimatedTabBar`, `AppGradient`, `Logo`.
From `src/components/farms/`: `EmptyState`, `StatCard`, `StatusBadge`, `SectionHeader`, `InfoRow`, `Timeline`, `FieldCard`/`FarmCard` (for read-only context), `FieldMapView`.
From `src/components/assessment/`: `SectionHeader`, `QuestionHeader`, `ScoreSelector` (0-3 picker), `QuestionFooter`. The assessor's question screen is the **same editable form as the farmer's** - reuse these directly.
Reusable media: **`AppImagePicker`** - the assessor attaches **their own** evidence photos for each question (the question form is identical to the farmer's: score + comment + evidence upload).

New components you will likely add (only if nothing fits): `AssignmentCard`, `SubmittedByChip` ("By Farmer" / "By Assessor (you)"). **Do NOT build review-comparison components** (no `ReviewQuestionRow`, `VerdictChip`, `ScoreCompareBar`) - there is no farmer-vs-assessor comparison; the assessor authors their own answers.

---

## 7. Navigation (role-based)

- Read `src/navigation/RootNavigator.tsx`, `AppNavigator.tsx`, `BottomTabNavigator.tsx`, `navigationTypes.ts`, and `src/redux/slices/authSlice.ts` / `userSlice.ts` to find where the authed user + role live.
- After authentication, **branch on `user.role`**: `farmer` → existing `BottomTabNavigator`; `assessor` → a new `AssessorTabNavigator`. Keep shared pushed screens (Profile, EditProfile, ChangePassword) reusable by both.
- **Assessor bottom tabs:** `Home` (Dashboard) · `Farmers` (assigned) · `History` · `More`. (The assessment opens from a field card - no center Quick-Action needed.)
- Add an `AssessorStackParamList` (or extend `AppStackParamList`) with: `AssessorDashboard`, `AssignedFarmers`, `FarmerDetail { farmerId }`, `FarmDetail { farmId, farmerName }`, `AssessmentSummary { fieldId, farmerName }`, `AssessmentQuestion { fieldId, categoryId, questionId }`, `AssessmentReview { fieldId }`, `AssessorHistory`.
  > These mirror the farmer's own assessment screen names (Summary / Question / Review) because it is the **same flow**, just scoped to an assigned field.

---

## 8. Screen-by-screen spec (wireframes + annotations)

Build to the same density/annotation style as the farmer markup. ASCII wireframes below are the target layout; annotations call out behavior.

### A. Assessor Dashboard  (`AssessorDashboardScreen`)
```
┌────────────────────────────┐
│ ☰  iiGrain            🔔   │  AppHeader variant="title", showDrawer
│ Good morning, Asha          │  greeting from profile.fullName
│ Assessor · Default Org      │
├────────────────────────────┤
│ [ 12 ]  [ 5 ]  [ 3 ]  [ 1 ]│  StatCard row: Assigned / Pending / Done / Overdue
│ Assigned Pending Done Over  │
├────────────────────────────┤
│ Needs your review           │  SectionHeader
│ ┌────────────────────────┐ │
│ │ 👤 Field Farmer        │ │  AssignmentCard:
│ │ Green Valley Farm·4 fld│ │   farmer name, farm/field count,
│ │ 18/31 submitted  ● Due │ │   submitted progress, status chip, due date
│ └────────────────────────┘ │
│ … list …                    │
├────────────────────────────┤
│ Recent activity (Timeline)  │
└────────────────────────────┘
```
*Stats from assignments repo; tapping a card → FarmerDetail. Pull-to-refresh. Loading/empty/error states.*

### B. Assigned Farmers  (`AssignedFarmersScreen`)
```
┌────────────────────────────┐
│ ←  Farmers            ⛯    │  filter icon
│ [ All ][ Pending ][ Done ] │  AnimatedTabBar / segmented filter
│ 🔎 Search farmer…          │
├────────────────────────────┤
│ AssignmentCard (as above)   │  FlatList, getItemLayout, RefreshControl
│ AssignmentCard …            │
│ EmptyState when none        │
└────────────────────────────┘
```
*Only farmers assigned to **me**. Filter by status (has pending fields to assess / all done). Search by farmer name. Note (assignment.note) shown as a subtle caption. Tap → FarmerDetail.*

### C. Farmer detail → farms → fields  (`FarmerDetailScreen` → `FarmDetailScreen`)
```
┌────────────────────────────┐      ┌────────────────────────────┐
│ ←  Field Farmer            │      │ ←  Green Valley Farm       │
│ ┌ Farmer card ───────────┐ │      │ Illinois · 1,250 ac · 4 fld│
│   name, email, org, note   │      │ Fields (4)                  │
│ Farms (2)                   │      │ ┌ FieldCard ─────────────┐ │
│ ┌ FarmCard ─────────────┐ │  →   │ │ North Field   🔒 Done   │ │ already assessed by you → View
│ │ Green Valley · 4 flds  │ │      │ │ By Assessor · 78%       │ │
│ │ View fields ›          │ │      │ ├────────────────────────┤ │
│ └────────────────────────┘ │      │ │ West Field    Pending   │ │ not yet → [ Assess ]
│ ┌ FarmCard · 2 flds ─────┐ │      │ │ ✎ You assess            │ │
└────────────────────────────┘      └────────────────────────────┘
```
*Read-only farmer/farm context (reuse FarmCard/FieldCard). Each field shows the assessor's OWN assessment status: **Done** (you submitted → View, read-only) or **Pending** (not yet → **Assess**, opens the fresh assessment form). The farmer's own assessment is NOT shown/compared here - the assessor authors a separate assessment. Field card → AssessmentSummary.*

### D. Assessment summary  (`AssessmentSummaryScreen`) - same UI as the farmer's
```
┌────────────────────────────┐
│ ←  North Field             │  AppHeader back
│ 2026 Annual Assessment      │
│ You are assessing · pending │  this is the ASSESSOR's own assessment
│ ▓▓▓▓▓░░░  18/31 completed   │  progress = assessor's answered count
├────────────────────────────┤
│ ▸ Soil Health      5/6      │  category rows (reuse the farmer category card)
│ ▸ Water Stewardship 3/4     │
│ …                           │
├────────────────────────────┤
│ [ Continue Assessment ]     │  → first unanswered question
└────────────────────────────┘
```
*Identical to the farmer's `AssessmentSummaryScreen`. Categories show the assessor's own progress (answered / total). No farmer data here - this is a fresh assessment.*

### E. Question form & scoring  (`AssessmentQuestionScreen`) - the core screen (identical to the farmer's)
```
┌────────────────────────────┐
│ ←  Question           5/31 │  QuestionHeader (category, index, code, text, guidance)
│ b4. Pest predator habitat   │
│ ✎ Pending - you are assessing
├ SELECT SCORE ──────────────┤  editable
│  [0][1][2●][3]             │  ScoreSelector (the assessor's own 0-3 score)
├ EVIDENCE / COMMENT ────────┤
│  AppTextInput multiline     │  maxLength 500, counter
├ UPLOAD EVIDENCE ───────────┤
│  [📷][📷][＋]              │  AppImagePicker - assessor's own photos
├────────────────────────────┤
│ [ Save Draft ]   [ Next ]  │  QuestionFooter; Save → PUT answer (upsert, repo), advance
└────────────────────────────┘
```
*The **same editable form the farmer uses** - there is NO farmer-answer block and NO verdict. The assessor picks their own 0-3 score, writes a comment, and uploads their own evidence. Save is an upsert (mirror `saveAssessmentAnswerThunk`): optimistic progress update in the slice, no full reload. Prev/Next via `navigation.setParams({ questionId })`.*

### F. Review & submit  (`AssessmentReviewScreen`) - same UI as the farmer's
```
┌────────────────────────────┐
│ ←  Review & Submit         │
│ Your answers:               │  each question: your score (reuse farmer review row)
│ b4 Pest predator habitat  2 │
│ b5 Invasive species       3 │
│ c1 Nutrient plan          1 │
│ ▓▓▓▓▓▓▓  31/31 completed    │
│ ⚠ After submit it locks     │  callout
│ [ Submit Assessment ]       │  POST submit (repo). Confirm dialog. Locks (complete).
│ Stamped: By Assessor · #A-204
└────────────────────────────┘
```
*Same Review & Submit UI as the farmer. Lists the assessor's own answers. **Submit finalizes and locks** the assessment - there is **no admin review / sign-off**; submitting completes it. Stamped "By Assessor". Confirm dialog before submit.*

### G. History  (`AssessorHistoryScreen`)
```
┌────────────────────────────┐
│ 🕘 History            ⛯    │  farmer filter (chips / AppDropdown)
│ [ Field Farmer ][ All ▾ ]   │
├────────────────────────────┤
│ North Field · 2026   78%    │  submitted assessments, grouped by farmer
│ By Farmer · #F-1029   🔒    │  shows BOTH farmer- and assessor-submitted records
│ West Field · 2026    88%    │
│ By Assessor · #A-204  🔒    │  the assessor's own submissions
│ …                           │
└────────────────────────────┘
```
*Grouped by farmer id → all submitted (locked) assessments for their fields. Shows **both** "By Farmer" and "By Assessor (you)" records via `SubmittedByChip`, each its own entry. Tap → read-only assessment view. (This is the 3rd bottom tab - matches the markup; no Reports/Export screen for now.)*

### H. More / Profile
*Reuse the existing `ProfileScreen` / `EditProfileScreen` / `ChangePasswordScreen` and the `More` tab; just ensure they render for the assessor role. Drawer content can show role = Assessor.*

---

## 9. Data layer & state (dummy → real swap)

1. **Domain types** (`src/types/assessor.ts`): `AssessorAssignment`, `AssessorAssessmentSummary`, `AssessorCategoryProgress`, `AssessorQuestion` (the question + the **assessor's own** answer: `answerScore`, `answerComment`, `answerEvidenceUrls`, `answered` - exactly like the farmer's `AssessmentQuestion`), `AssessorFieldStatus = 'pending' | 'in_progress' | 'submitted'`, summary/stat types. Make these the *future API contract*. **No `verdict`, no farmer-answer fields.**
2. **Repository** (`src/data/assessorRepository.ts`): in-memory seed data shaped EXACTLY like §3.4 responses, returned via `Promise` with a tiny artificial delay so loading states render. Pull realistic names from the assessor_assignments shape (assessor/farmer name+email, note). Seed both pending and already-submitted fields so both states render.
3. **API module** (`src/api/AssessorApi.ts`): request functions call the repository **today**; each has a `// TODO(backend): replace with http.get(Endpoints.assessor.*)` and the proposed path from §3.4. Signatures/returns are final, so the swap is mechanical.
4. **Thunks + slice + selectors** per §5. Optimistic updates for save-answer and submit, **mirroring `assessmentSlice` 1:1** (the assessor flow IS the farmer assessment flow, scoped to an assigned field).
5. **Endpoints registry:** add a commented `assessor: { … }` block to `src/config/endpoints.ts` with the proposed paths, marked *not yet live*, so it's ready when the backend ships.

---

## 10. File/folder layout to create

```
src/types/assessor.ts
src/data/assessorRepository.ts
src/api/AssessorApi.ts
src/redux/thunks/assessorThunks.ts
src/redux/slices/assessorSlice.ts            (+ register in store.ts)
src/navigation/AssessorTabNavigator.tsx       (+ params in navigationTypes.ts; role-branch in App/RootNavigator)
src/screens/assessor/
  AssessorDashboardScreen.tsx (+Style)
  AssignedFarmersScreen.tsx (+Style)
  FarmerDetailScreen.tsx (+Style)
  FarmDetailScreen.tsx (+Style)
  AssessmentSummaryScreen.tsx (+Style)     # same flow as the farmer's
  AssessmentQuestionScreen.tsx (+Style)    # same editable form as the farmer's
  AssessmentReviewScreen.tsx (+Style)      # Review & Submit (submitting completes it)
  AssessorHistoryScreen.tsx (+Style)
src/components/assessor/      (AssignmentCard, SubmittedByChip) - only as needed
docs/BACKEND-GAPS.md          (list the §3.4 endpoints the backend must add)
```

---

## 11. Build order (do it in this sequence)

1. Read the canonical farmer files (`FarmApi`, `farmThunks`, `farmSlice`, `FarmsScreen`, `FarmDetailsScreen`, `AssessmentQuestionDetailScreen`) to internalize the patterns.
2. Add role detection + the `assessor` navigation branch (smallest vertical slice: login as assessor → empty Dashboard).
3. Types → repository (seed) → AssessorApi → thunks → slice → selectors.
4. Dashboard → AssignedFarmers → FarmerDetail → FarmDetail (lists + read-only context).
5. AssessmentSummary → AssessmentQuestion (the core scoring loop, same form as farmer) → AssessmentReview → Submit.
6. History (grouped by farmer) + More/Profile reuse.
7. Polish: loading/empty/error states, RefreshControl, accessibility labels, responsive spacing.
8. `npx tsc --noEmit` clean; write `docs/BACKEND-GAPS.md`.

---

## 12. Definition of done

- [ ] Logging in as an `assessor` lands on the Assessor tabs; a `farmer` is unaffected.
- [ ] All seven screens render with real loading/empty/error/refresh states and match the farmer module's look.
- [ ] The whole assessor data flow runs through one repository that is a drop-in for the §3.4 endpoints (no nonexistent endpoint is ever hit).
- [ ] Scoring loop works: open a pending field → fill each question (own 0-3 score + comment + evidence) → save (optimistic) → next → Review → **Submit (completes & locks; no admin review)**. A submitted field becomes read-only ("By Assessor").
- [ ] No hardcoded colors/sizes; all text via `AppText`; no `any`; `tsc` clean (except the 2 known `gray200`).
- [ ] `docs/BACKEND-GAPS.md` lists the assessor endpoints the backend still needs.

---

## 13. Do NOT do

- ❌ Edit anything under `backend/`.
- ❌ Call `assessor-assignments` or `/assessments/my/...` as the assessor (they 403 / are owner-scoped).
- ❌ Invent live endpoints or hit URLs that don't exist - everything not in §3.1 goes through the repository.
- ❌ Add native modules without calling out the rebuild.
- ❌ Redesign shared components or the design system. Extend, don't fork.

**When in doubt, open the equivalent farmer file and copy its structure.** The farmer module is your reference implementation; the assessor module should read as its sibling.
