# iiGrain - Assessor Module · Flow, UI-Reuse & Optimisation Plan

> **This is a PLAN, not code.** It is the blueprint for adding the **Assessor** experience to the existing iiGrain app by **reusing the live farmer UI** so the two roles look identical. Every claim here is grounded in the real codebase (file paths are exact). Pair it with the two sibling docs: `ASSESSOR_APP_BUILD_GUIDE.md` (build brief) and `assessor-ui-markup.html` (visual flow). **Take the FLOW from the HTML; take the LOOK from the live app.**

---

## 0. Golden principles (read first)

1. **Reuse-first.** ~95% of the assessor UI is already built. We reuse the farmer app's **components verbatim** and **clone screen layouts**, only swapping the data source. A reviewer must not be able to tell the two roles apart visually.
2. **Same look, new flow.** The `assessor-ui-markup.html` defines *what screens exist and how they connect*. It does **not** define styling - the styling comes from the live app's components and `src/constants/*` tokens. Never copy the HTML's colours/spacing; use the real components.
3. **Dummy data now, real API later.** There are **no assessor backend endpoints yet** (confirmed). Back everything with a dummy repository typed to the eventual contract, so the swap to real APIs is a one-line change per request function - **zero UI change** (same pattern the farmer module shipped with).
4. **Role-gated, one app.** Same login. After auth, `role` decides the tab set. The farmer flow is untouched.
5. **Never change the backend.** `c:\farmer-app\backend` is read-only.
6. **Production discipline.** No `any`, TypeScript strict, `AppText`/`AppTextInput` everywhere, `tsc` clean, structural selectors (no `RootState` import), reset on logout.

---

## 1. What the assessor does (the model)

- Role `assessor` (in `backend/src/config/rbac.ts`). An org-manager assigns an assessor to a farmer (`assessor_assignments`, with a `note`).
- The assessor opens an **assigned farmer → that farmer's farms → fields → a field → conducts their OWN independent assessment** of the field using the **exact same assessment form the farmer uses** (categories → questions → score 0-3 + comment + evidence) → **review → submit**.
- **Submit finalises (locks)** the assessor's assessment. **There is no admin review / sign-off.**
- The assessor's assessment is a **separate, independent record** - it coexists with any farmer self-assessment of the same field. A field can have **two assessments on record**: one *By Farmer*, one *By Assessor*, each stamped with the submitter's user id + role, each locked once submitted.
- **No "skip the questions the farmer already did"** and **no farmer-answer comparison.** The assessor fills every question themselves; it is *their* assessment.

---

## 2. Navigation & role-gating plan

### 2.1 Where role comes from
- Selector **`selectAuthUser`** (`src/redux/slices/authSlice.ts`) → `AuthUser.role` (a string). Available **synchronously the moment login succeeds** (loginThunk stores the user; status flips to `authenticated`). Mirror also in `selectProfile` (`userSlice`).

### 2.2 The single branch point - `BottomTabNavigator`
The whole role split happens in **`src/navigation/BottomTabNavigator.tsx`**. It reads the role and renders a **different set of `<Tab.Screen>`** - everything above (RootNavigator auth gate, AppNavigator stack, AppDrawer) and the `CustomTabBar` are reused unchanged.

```
RootNavigator (auth gate - unchanged)
└─ AppNavigator (stack - add a few assessor detail screens)
   └─ AppDrawer → BottomTabNavigator   ← ROLE BRANCH HERE
      ├─ role === 'farmer'  → Home · Assessment · Farms · More   (current)
      └─ role === 'assessor'→ Home · Farmers · History · More    (new)
```

### 2.3 Assessor bottom tabs
| Tab | Screen (new/reused) | Icon pair (add to `CustomTabBar` ICONS) |
|---|---|---|
| **Home** | `AssessorDashboardScreen` (new) | `view-dashboard-outline` / `view-dashboard` |
| **Farmers** | `AssessorFarmersScreen` (new, clone of FarmsScreen) | `account-group-outline` / `account-group` |
| **History** | `AssessorHistoryScreen` (new) | `history` / `history` |
| **More** | `MoreScreen` (**reused as-is**) | already defined |

Touch points (small, additive):
- **`src/components/BottomTab/CustomTabBar.tsx`** - add the two new tab names to the `ICONS` map. Decide the **centre FAB**: the farmer FAB jumps to Assessment; the assessor has no single "create" entry (assessment opens from a field card), so **hide the FAB for the assessor** (simplest) - the tab bar already lays out N tabs.
- **`src/config/drawerConfig.ts`** - add `tabToModule` entries for `Farmers`/`History` (map to a sensible drawer module, e.g. `'farm'`/`'dashboard'`). The drawer logic itself is reused.
- **`src/navigation/navigationTypes.ts`** - add an assessor branch to the tab param list and the new pushed-screen routes (see §6).

### 2.4 Assessor stack (pushed over the tabs - reuse the existing stack)
Add to `AppStackParamList`:
- `AssessorFarmerDetail: { farmerId: string }`
- `AssessorFarmDetail: { farmerId: string; farmId: string }`
- **Assessment is reached by reusing the existing `Assessment` tab/screens** (or pushing `AssessmentCategory` / `AssessmentQuestionDetail`) with the chosen `fieldId` - **no new assessment screens**.

---

## 3. Screen-by-screen REUSE MAP (the heart of the plan)

Legend: **REUSE** = use the live component/screen unchanged · **CLONE** = new screen, same components + layout, different data selector.

### 3.1 Assessor Dashboard - `AssessorDashboardScreen` (Home tab) - NEW (light)
Flow (from HTML §screen 1): greeting + counts + **Recent done assessments** (By Farmer / By Assessor) + **Assigned farmers** preview.
| Build with (all REUSE) | Data (dummy) |
|---|---|
| `AppHeader` (variant `title`, drawer, notification) · `StatCard` row · farms `SectionHeader` · a list of `FarmCard`-style rows for assigned farmers · `EmptyState` · pull-to-refresh | `assessorRepository.getDashboard()` → counts + recent list + assigned preview |
*Note: the current `HomeScreen` is a placeholder ("Coming Soon"); we don't reuse its body, only the header pattern.*

### 3.2 Assigned Farmers - `AssessorFarmersScreen` (Farmers tab) - CLONE of `FarmsScreen`
Flow (HTML §2): list of farmers assigned to me + search + status.
| Reuse | Differs |
|---|---|
| `FarmsScreen` structure: `AppHeader`, `AnimatedTabBar` (optional), `FlatList` + `getItemLayout`, `RefreshControl`, `EmptyState`. Render **`FarmCard`** per farmer (name, sub-line = farm/field counts, status badge). | Remove the "Add Farm" FAB. Data from `selectAssignedFarmers` (assessor slice), not `selectFarms`. Tap → `AssessorFarmerDetail`. |

### 3.3 Farmer Detail (farms + fields count) - `AssessorFarmerDetailScreen` - CLONE of `FarmDetailsScreen`
Flow (HTML §3): farmer info + that farmer's farms, each with **fields count**.
| Reuse | Differs |
|---|---|
| `FarmDetailsScreen` layout: `AppHeader` (back), `FarmSummaryCard` (→ farmer identity), `StatCard` grid, farms `SectionHeader`, **`FarmCard`** list (each shows `Fields: N`). | Read-only: **hide the edit action**. Data from assessor slice (`selectAssignedFarmerFarms`). Tap a farm → `AssessorFarmDetail`. |

### 3.4 Farm Detail (fields + "See more" + Assessment button) - `AssessorFarmDetailScreen` - CLONE of `FarmDetailsScreen`/`FieldDetailsScreen`
Flow (HTML §4): fields list with details; each card has inline **See more** + an **Assessment** button; pending vs farmer-done status.
| Reuse | Differs |
|---|---|
| `AppHeader`, farms `SectionHeader`, **`FieldCard`** per field, `StatCard`/`InfoRow` for the expanded "See more", `Button` (the Assessment CTA on each card). Optionally `FieldChips`/parcel map from `FieldDetailsScreen` (read-only). | No "Add Field". Each card shows the **assessment status** (`By Farmer 78%` / `Pending`). The **Assessment button** navigates into the **reused Assessment flow** for that `fieldId`. |

### 3.5 Assessment - Summary - **REUSE `AssessmentScreen` as-is**
Flow (HTML §5): the assessment overview (categories + progress + Continue). **This is the same screen the farmer uses.**
| Reuse | Differs |
|---|---|
| `AssessmentScreen` (`AssessmentSummaryCard`, `CategoryProgressList`, `AnimatedTabBar`, `AppHeader`) - **unchanged**. | Only the **data behind `fieldId`** is the assessor's assessment (provided by the dummy repo). A locked/"By Assessor" badge is part of the data (`AssessmentInfo.status` + a submitter field). |

### 3.6 Assessment - Category questions - **REUSE `AssessmentCategoryScreen` as-is**
`CategorySummaryCard` + `QuestionCard` list. Data-source-agnostic - reuse unchanged.

### 3.7 Assessment - Question form - **REUSE `AssessmentQuestionDetailScreen` as-is**
Flow (HTML §6): the same form - `QuestionHeader`, **`ScoreSelector`** (0-3), `AppTextInput` comment, **`AppImagePicker`** evidence, **`QuestionFooter`** (Save Draft / Next).
- **Editable while in progress; locked after submit.** The domain type **`AssessmentQuestionDetail` already has a `locked: boolean`** field - the screen already renders read-only when locked (`disabled` ScoreSelector / picker). So locking the assessor's submitted assessment needs **no new screen**: the repo returns `locked: true` after submit.

### 3.8 Review & Submit → lock - **REUSE the farmer review/submit pattern**
The farmer flow already has review/submit (`/review`, `/submit`). The assessor reuses the same screen/flow; **submit stamps "By Assessor" and locks** (data-driven). No admin step.

### 3.9 History - `AssessorHistoryScreen` (History tab) - NEW (light)
Flow (HTML §7): grouped by farmer → all fields' assessments (By Farmer / By Assessor, score, date, 🔒), read-only.
| Build with (REUSE) | Data (dummy) |
|---|---|
| `AppHeader`, `AnimatedTabBar`/chips (farmer filter), `FlatList` of `FarmCard`/`QuestionCard`-style rows, `StatusBadge`, `EmptyState`. | `assessorRepository.getHistory(farmerId?)` → list of locked assessments with submitter id+role. Tap → reused read-only Assessment summary. |

### 3.10 More / Profile - **REUSE `MoreScreen` + `ProfileScreen` as-is**
Same menu + profile (role badge already shows the role). No changes.

---

## 4. Data & state plan (dummy → real, mirrors existing patterns 1:1)

### 4.1 New files (mirror `farmSlice`/`assessmentSlice` exactly)
- **`src/types/assessor.ts`** - domain models: `AssignedFarmer`, `AssessorFarm` (reuse `Farm`/`Field` where possible), `AssessorHistoryItem`, `AssessorDashboard`, plus a `SubmittedBy = { id: string; role: 'farmer' | 'assessor'; name: string }` stamp. Make these the **future API contract**.
- **`src/data/assessorRepository.ts`** - dummy data + sync(or tiny-delay) functions: `getDashboard()`, `getAssignedFarmers()`, `getFarmerFarms(farmerId)`, `getFarmFields(farmId)`, `getHistory(farmerId?)`. Follows the `dummyFarms.ts` style (array exports + keyed lookups + `?? []` fallbacks).
- **`src/redux/slices/assessorSlice.ts`** + **`src/redux/thunks/assessorThunks.ts`** - `createAsyncThunk` + `handleApiError` + `rejectWithValue(StandardizedError)`; `loading/refreshing/error` flags per resource; **structural selectors** (`interface HasAssessor { assessor: AssessorState }`); **reset on `logout`**. Register in `src/redux/store.ts` next to `assessment` (**not** persisted - same as farm/field/assessment).
- **`src/api/AssessorApi.ts`** - the 5-part structure (Envelope, Raw, Input, Mappers, Request fns). In dummy phase each request fn calls `assessorRepository`; each carries `// TODO(backend): replace with http.get(Endpoints.assessor.*)` + the proposed path. Signatures are final, so the swap is mechanical.

### 4.2 The assessment-screen data (the key reuse decision)
The assessor's **assessment** (summary/category/question/save/submit) reuses the **existing assessment screens**. Because a session is single-role (an assessor never sees farmer assessment state and vice-versa), the **simplest max-reuse path** is:
- **Reuse the existing `assessmentSlice` + screens.** In the dummy phase, point the assessment thunks' data source at an **assessor-aware dummy repo** (the thunks already take `fieldId`). The "By Assessor" + `locked` flags come from the data.
- *Alternative (cleaner separation, slightly more code):* a parallel `assessorAssessmentSlice` mirroring `assessmentSlice`. **Recommendation: start with reuse** (less code, identical UI); split later only if farmer+assessor assessment state ever need to coexist in one session.

### 4.3 Persistence & reset
Assessor data is **not persisted** (root whitelist is empty; only `user.profile` persists). All assessor state **clears on logout** via the existing `logout` reset pattern.

---

## 5. Submission & lock model (data-driven, no new UI)
- Every assessment record carries `submittedBy: { id, role }` and a status. **`AssessmentQuestionDetail.locked`** (already in `types/assessment.ts`) drives read-only rendering - reused.
- Lists/History show a **"By Farmer" / "By Assessor"** chip - render via the existing **`StatusBadge`** with a tone, no new component required.
- Submit → repo marks the record locked; reopening shows the reused screens in read-only state.

---

## 6. File / folder plan (what to create - all new, no edits to farmer screens)
```
src/types/assessor.ts                       (domain + future contract)
src/data/assessorRepository.ts              (dummy data + getters)
src/api/AssessorApi.ts                      (5-part; calls repo now)
src/redux/slices/assessorSlice.ts           (+ register in store.ts)
src/redux/thunks/assessorThunks.ts
src/screens/assessor/
  AssessorDashboardScreen.tsx   (+Style)
  AssessorFarmersScreen.tsx     (+Style)   ← clone of FarmsScreen
  AssessorFarmerDetailScreen.tsx(+Style)   ← clone of FarmDetailsScreen
  AssessorFarmDetailScreen.tsx  (+Style)   ← clone of FarmDetails/FieldDetails
  AssessorHistoryScreen.tsx     (+Style)
src/components/assessor/  (only if a card needs a status variant; prefer reuse)
```
**Edited (additive, minimal):** `BottomTabNavigator.tsx` (role branch), `CustomTabBar.tsx` (ICONS), `drawerConfig.ts` (tabToModule), `navigationTypes.ts` (assessor routes), `store.ts` (register slice), `AppNavigator.tsx` (register assessor detail screens). **Reused unchanged:** all `src/components/*`, all `assessment/*` screens, `MoreScreen`, `ProfileScreen`, RootNavigator, AppDrawer.

---

## 7. Build phases (each phase is shippable & testable)
1. **Role branch skeleton** - `selectAuthUser().role` in `BottomTabNavigator`; assessor sees 4 tabs with placeholder screens. Farmer flow unaffected. (Smallest vertical slice.)
2. **Data spine** - `types/assessor.ts` → `assessorRepository` (seed) → `AssessorApi` → `assessorThunks` → `assessorSlice` → selectors → register in store.
3. **Browse flow** - Dashboard → Assigned Farmers → Farmer Detail → Farm Detail (reusing FarmCard/FieldCard/StatCard/etc.).
4. **Assessment flow** - wire the field card's **Assessment** button into the **reused** AssessmentScreen/Category/QuestionDetail, fed by the assessor data source; verify locked/read-only and "By Assessor".
5. **History tab** - list grouped by farmer; tap → reused read-only summary.
6. **Polish & optimise** (§8) + `tsc` clean.

---

## 8. Optimisation plan ("complete optimize")
- **Reuse = less surface.** Cloning + shared components keeps the bundle and bug surface small; no design drift.
- **Lists:** `FlatList` with `keyExtractor` + `getItemLayout` (as `FarmsScreen` does) for assigned-farmers/history; `removeClippedSubviews` for long lists.
- **No redundant fetches:** copy the **fetch-guard** pattern already added to the farmer detail screens - only fetch when the target id ≠ the loaded id; rely on slice in-place updates after mutations. Dashboard/Farmers fetch **only when empty**; pull-to-refresh for manual reload.
- **Selectors:** structural `HasAssessor` selectors returning **stable empty constants** (`EMPTY_X`) so missing data doesn't re-render.
- **Memoisation:** `React.memo` on row components (FarmCard/FieldCard already are), `useCallback` for `onPress`, `useMemo` for derived lists/presenter output (reuse the `assessmentPresenter.ts` adapters).
- **Dummy realism:** repository may add a tiny `await` delay so loading/skeleton states render exactly like production; remove on real-API swap.
- **Images:** evidence via the existing `AppImagePicker` (already optimised: cap 5, size guard, temp cleanup); History shows thumbnails lazily.
- **One source of truth:** never duplicate design tokens or card markup - import from `src/constants/*` and `src/components/*`.

---

## 9. Definition of done
- [ ] Login as `assessor` → assessor tabs (Home · Farmers · History · More); login as `farmer` → unchanged.
- [ ] Browse: Dashboard → Assigned Farmers → Farmer (farms + fields count) → Farm (fields, See more, Assessment button) - visually identical to the farmer screens (same components).
- [ ] Assessment: the **same** AssessmentScreen/Category/QuestionDetail are reused; assessor fills every question, reviews, submits → **locks** + stamped **By Assessor**.
- [ ] History grouped by farmer shows By Farmer / By Assessor, read-only.
- [ ] All assessor data flows through `assessorRepository` (no nonexistent endpoint is hit); auth/profile are the only live calls.
- [ ] No farmer screen edited beyond the additive nav touch points; no hardcoded colours/sizes; no `any`; `tsc` clean.

---

## 10. Open decisions (pick before coding)
1. **Centre FAB for the assessor** - recommend **hide it** (no single create action); confirm.
2. **Reuse `assessmentSlice` vs parallel `assessorAssessmentSlice`** - recommend **reuse** for the dummy phase (max reuse, identical UI); revisit only if both must coexist in one session.
3. **Assigned-farmers/farms data** - a new `assessorSlice` (recommended, since the data is *another* farmer's farms, not "my farms" in `farmSlice`). Confirm we do **not** reuse `farmSlice` for assessor browse.
4. **Tab names** - `Home / Farmers / History / More` (recommended) vs keeping farmer names. New names need the small `CustomTabBar` ICONS + `drawerConfig` additions noted in §2.3.

---

### One-line summary
Branch on `role` in `BottomTabNavigator`; build 4 light assessor screens that **clone farmer layouts and reuse every component**; **reuse the assessment screens verbatim** for the assessor's own (lockable) assessment; back it all with a dummy `assessorRepository` mirroring the existing slice/thunk/selector patterns - so the assessor app looks exactly like the farmer app, takes only its *flow* from the HTML, and swaps to real APIs later with zero UI change.

---
---

# Part II - Architecture Reference (Appendix)

> This part deepens Part I for the implementing team. It **adds** diagrams, tables, and operational detail without changing any decision above. Sections are numbered 11+ to continue cleanly. Where a topic is introduced in Part I, the reference here expands it (and says so) rather than repeating it.

---

## 11. System architecture (layered)

The assessor module uses the **same strict layering as the rest of the app**. Dependencies point **downward only** (a layer never imports a layer above it), which keeps the graph acyclic and the dummy→real swap mechanical.

```
┌──────────────────────────────────────────────────────────────┐
│ SCREENS            src/screens/assessor/*  (+ reused screens) │  React, hooks, navigation
│  └─ presenters     src/screens/**/*Presenter.ts (reuse)       │  domain → view-model (pure)
├──────────────────────────────────────────────────────────────┤
│ SELECTORS          structural `HasAssessor` selectors          │  read-only, memo-stable
├──────────────────────────────────────────────────────────────┤
│ STATE (slice)      redux/slices/assessorSlice.ts               │  extraReducers, flags, reset
│ THUNKS             redux/thunks/assessorThunks.ts              │  createAsyncThunk + handleApiError
├──────────────────────────────────────────────────────────────┤
│ API                api/AssessorApi.ts                          │  Envelope→Raw→Mapper→Domain
│   ├─ dummy now ──► data/assessorRepository.ts                 │  in-memory, swappable
│   └─ real later ─► services/http.ts → backend (/assessor/*)    │  axios, bearer, refresh, errors
├──────────────────────────────────────────────────────────────┤
│ TYPES              types/assessor.ts  (+ reuse types/*.ts)     │  domain models = future contract
└──────────────────────────────────────────────────────────────┘
```

**Rule:** screens never call the API or repository directly - only `dispatch(thunk)` + `useAppSelector`. The API file is the **only** place wire→domain mapping happens. This is identical to `FarmApi`/`farmThunks`/`farmSlice`.

---

## 12. Navigation hierarchy & route table

Full hierarchy with the assessor branch (extends Part I §2):

```
RootNavigator (auth gate)
└─ AppNavigator (NativeStack)
   ├─ Shell → AppDrawer → BottomTabNavigator   ← role branch
   │   ├─ farmer: Home · Assessment · Farms · More
   │   └─ assessor: Home(Dashboard) · Farmers · History · More
   └─ (pushed over tabs, shared stack):
      AssessorFarmerDetail · AssessorFarmDetail
      Assessment · AssessmentCategory · AssessmentQuestionDetail   (REUSED)
      Profile · EditProfile · ChangePassword                       (REUSED)
```

| Route | Navigator | Params | Screen | Reuse |
|---|---|---|---|---|
| `Home` (assessor) | Tab | - | `AssessorDashboardScreen` | new |
| `Farmers` | Tab | - | `AssessorFarmersScreen` | clone FarmsScreen |
| `History` | Tab | - | `AssessorHistoryScreen` | new |
| `More` | Tab | - | `MoreScreen` | **reuse** |
| `AssessorFarmerDetail` | Stack | `{ farmerId }` | `AssessorFarmerDetailScreen` | clone FarmDetails |
| `AssessorFarmDetail` | Stack | `{ farmerId, farmId }` | `AssessorFarmDetailScreen` | clone Farm/FieldDetails |
| `Assessment` | Tab/Stack | `{ fieldId }` | `AssessmentScreen` | **reuse verbatim** |
| `AssessmentCategory` | Stack | `{ fieldId, categoryId, categoryName }` | `AssessmentCategoryScreen` | **reuse verbatim** |
| `AssessmentQuestionDetail` | Stack | `{ fieldId, categoryId, questionId }` | `AssessmentQuestionDetailScreen` | **reuse verbatim** |

---

## 13. Screen responsibility matrix

| Screen | Responsibility | Reads (selectors) | Dispatches (thunks) | Navigates → | States it must render |
|---|---|---|---|---|---|
| AssessorDashboard | Overview: counts, recent, assigned preview | `selectAssessorDashboard`, `selectAssignedFarmers` | `fetchAssessorDashboardThunk` | Farmers, FarmerDetail | loading · empty · error · loaded |
| AssessorFarmers | List assigned farmers + search | `selectAssignedFarmers`, `…Loading/Refreshing/Error` | `fetchAssignedFarmersThunk`, `refresh…` | FarmerDetail | loading · empty · error · refresh |
| AssessorFarmerDetail | Farmer info + farms (fields count) | `selectAssignedFarmerFarms` | `fetchAssignedFarmerFarmsThunk` | FarmDetail | loading · empty · error |
| AssessorFarmDetail | Fields + “See more” + Assess CTA | `selectAssessorFarmFields` | `fetchAssessorFarmFieldsThunk` | Assessment (per field) | loading · empty · error |
| Assessment (reused) | Assessment summary + categories | `selectAssessmentSummary`, `selectAssessmentCategories`, loading/error | `fetchAssessmentSummaryThunk`, `refresh…` | AssessmentCategory | loading · empty(no field) · error · locked |
| AssessmentCategory (reused) | Category question list | `selectCategoryQuestionList`, `selectQuestionList` | `fetchCategoryQuestionsThunk` | AssessmentQuestionDetail | loading · empty · error |
| AssessmentQuestionDetail (reused) | Answer/score/evidence (or read-only if locked) | `selectQuestionDetail`, `selectAssessmentSaving` | `fetchQuestionDetailThunk`, `saveAssessmentAnswerThunk` | prev/next/back | loading · saving · error · **locked(read-only)** |
| AssessorHistory | Records grouped by farmer | `selectAssessorHistory` | `fetchAssessorHistoryThunk` | reused read-only summary | loading · empty · error |
| More / Profile (reused) | Menu + profile | `selectProfile` | `fetchProfileThunk` | Edit/Change/Logout | skeleton · loaded · error |

---

## 14. Data model & relationships

Entities and cardinalities (the assessor's mental model; backed by dummy data now):

```
User(assessor) ──1:N── AssessorAssignment ──N:1── User(farmer)
                                                    │ 1:N
                                                    ▼
                                                  Farm ──1:N── Field
                                                                 │ 0:2  (at most one per submitter role)
                                                                 ▼
                                                       AssessmentRecord ──submittedBy{ id, role }──
                                                         │ 1:N
                                                         ▼
                                                   CategoryProgress ──1:N── Question ──1:1── Answer(score 0-3, comment, evidence[])
```

Key rule: **a Field can hold up to two AssessmentRecords - one `role:'farmer'`, one `role:'assessor'`** - independent, each lockable. The assessor app only ever reads/writes the `role:'assessor'` record.

**Domain interfaces** (new `types/assessor.ts` + reused `types/assessment.ts`):

| Interface | File | Purpose / key fields |
|---|---|---|
| `AssignedFarmer` | assessor.ts | `id, name, email, note, farmsCount, fieldsCount, pendingCount, status` |
| `AssessorFarm` | assessor.ts (or reuse `Farm`) | `id, name, location, areaAcres, fieldsCount` |
| `SubmittedBy` | assessor.ts | `{ id: string; role: 'farmer' \| 'assessor'; name: string }` |
| `AssessorHistoryItem` | assessor.ts | `fieldId, fieldName, year, percentage, submittedBy, submittedAtISO, locked` |
| `AssessorDashboard` | assessor.ts | `counts{assigned,done,pending}, recent: AssessorHistoryItem[], assignedPreview: AssignedFarmer[]` |
| `FieldAssessmentSummary` | assessment.ts (reuse) | `field, assessment(AssessmentInfo), categories[]` |
| `AssessmentQuestionDetail` | assessment.ts (reuse) | `…, answerScore, answerComment, answerEvidenceUrls, **locked**` |
| `SaveAnswerInput` / `SavedAnswer` | assessment.ts (reuse) | upsert payload / persisted answer |

---

## 15. Redux data-flow diagrams

**Generic flow (every assessor fetch):**
```
Screen mount → dispatch(fetchXThunk(arg))
  → thunk: try { return await AssessorApi.getX(arg) } catch { rejectWithValue(handleApiError(e)) }
      → AssessorApi.getX: (dummy) assessorRepository.getX(arg)
                          (real)  http.get(Endpoints.assessor.X) → mapX(raw)
  → slice.pending  : loading=true, error=null
  → slice.fulfilled: loading=false, state.X = payload
  → slice.rejected : loading=false, error=payload.message   (http layer also shows global modal)
  → selectX re-runs → screen re-renders
```

**Conduct assessment (reuses the assessment slice - no new screens):**
```
FarmDetail field card "Assess" → navigate(Assessment,{fieldId})
  → AssessmentScreen: fetchAssessmentSummaryThunk(fieldId)         [assessor data via repo]
  → tap category → AssessmentCategoryScreen: fetchCategoryQuestionsThunk
  → tap question → AssessmentQuestionDetailScreen
       edit score/comment/evidence → saveAssessmentAnswerThunk (UPSERT, optimistic progress)
  → Review → Submit → record.locked=true, submittedBy={role:'assessor'}
  → reopening any question → questionDetail.locked=true → screen renders read-only
```

**Submit & lock (state transition):**
```
status: not_started → in_progress (first saved answer) → completed+locked (on submit)
locked=false ──────────────────────────────────────────► locked=true (irreversible)
```

---

## 16. Repository → API → Mapper → Domain (and the Dummy→Real migration)

```
            ┌─────────────── AssessorApi.getAssignedFarmers() ───────────────┐
 NOW:       │  return assessorRepository.getAssignedFarmers()  // dummy       │
 LATER:     │  const r = await http.get<Envelope<RawAssignment[]>>(           │
            │            Endpoints.assessor.assignments);                     │
            │  return r.data.data.map(mapAssignedFarmer);   // Raw → Domain    │
            └────────────────────────────────────────────────────────────────┘
```

Migration table (each row is a one-function swap; signatures/return types stay identical):

| Repository fn (now) | Proposed endpoint (later) | Mapper | Swap step |
|---|---|---|---|
| `getDashboard()` | `GET /assessor/dashboard` (or compose) | `mapDashboard` | replace body, keep return type |
| `getAssignedFarmers()` | `GET /assessor/assignments` | `mapAssignedFarmer` | ″ |
| `getFarmerFarms(id)` | `GET /assessor/farmers/:id/farms` | `mapFarm` (reuse) | ″ |
| `getFarmFields(id)` | `GET /assessor/farms/:id/fields` | `mapField` (reuse) | ″ |
| `getHistory(id?)` | `GET /assessor/history?farmerId=` | `mapHistoryItem` | ″ |
| assessment summary/qs/save/submit | `/assessor/fields/:fieldId/...` | reuse assessment mappers | point the assessment thunks’ source at `/assessor/*` |

**Migration is gated only by backend availability** - see §23. Until then, everything except auth/profile runs through the repository.

---

## 17. State management spec

`assessorSlice` state shape (illustrative - mirrors `farmSlice`/`assessmentSlice` conventions; **not** persisted; reset on `logout`):

```
AssessorState {
  dashboard: AssessorDashboard | null
  assignedFarmers: AssignedFarmer[]
  farmerFarms: { farmerId: string | null; farms: AssessorFarm[] }   // stale-guard like fieldSlice
  farmFields:  { farmId: string | null;  fields: Field[] }
  history: AssessorHistoryItem[]
  loadingDashboard / loadingFarmers / loadingFarms / loadingFields / loadingHistory: boolean
  refreshing: boolean
  error: string | null
}
```
- **Selectors**: `selectAssessorDashboard`, `selectAssignedFarmers`, `selectAssignedFarmerFarms`, `selectAssessorFarmFields`, `selectAssessorHistory`, plus granular `…Loading`/`…Error`. All via `interface HasAssessor { assessor: AssessorState }` - never import `RootState`. Return **stable empty constants** for arrays.
- **Stale-guard**: `farmerFarms`/`farmFields` carry their parent id so switching farmers/farms drops the previous list immediately (same as `fieldSlice.farmId`).
- **Store**: register `assessor` reducer in `src/redux/store.ts`; **omit** from any persist whitelist (root whitelist stays empty; only `user.profile` persists).

---

## 18. Error-handling strategy (reuses the app's standard)

- Every thunk: `try { … } catch (e) { return rejectWithValue(handleApiError(e)) }` → produces `StandardizedError { message, status, kind }` (`kind: 'auth'|'validation'|'notFound'|'rateLimit'|'server'|'offline'|'unknown'`).
- The shared **`http` interceptor already surfaces a global error modal** for non‑401, non‑public failures; **401 → silent refresh → (fail) logout**. So assessor screens **do not** render their own error modal for write failures - they just avoid navigating on rejection and keep the inline list-level `error` for the empty/error state.
- **Dummy phase**: the repository can throw to exercise error paths (e.g. a seeded "force error" flag) so loading/error states are verifiable before the backend exists.
- **Form saves** (assessment): reuse the existing save flow's behavior (toast on success, global modal on failure) - no new handling.

---

## 19. UX states matrix (Loading / Empty / Error / Locked / Offline)

| Screen | Loading | Empty | Error | Locked / Read-only | Offline |
|---|---|---|---|---|---|
| Dashboard | spinner | “No activity yet” `EmptyState` | retry CTA | n/a | cached or global “no internet” |
| Farmers | spinner / skeleton | “No farmers assigned” | retry | n/a | global modal (online-first) |
| FarmerDetail | spinner | “No farms” | retry | n/a | ″ |
| FarmDetail | spinner | “No fields” | retry | per-field “Done” chip | ″ |
| Assessment (reused) | spinner | “Select a field” | retry | locked badge if submitted | ″ |
| QuestionDetail (reused) | spinner | - | global modal on save | **ScoreSelector/picker disabled when `locked`** | save blocked offline → modal |
| History | spinner | “No history” | retry | all rows 🔒 | ″ |

Reuse `EmptyState`, `ActivityIndicator`, and the existing error blocks (icon + title + message + Retry `Button`) - **do not invent new state UI**.

---

## 20. Offline & sync strategy

**Current reality:** the live app is **online-first** - there is no offline DB wired yet (the markup's “WatermelonDB/SQLite + sync queue + background sync” is the *target*, not current state). Plan accordingly:

- **Phase 1 (now):** online-first. The `http` layer already **retries transient network failures** and shows a friendly “No internet” modal. Assessor screens cache last-loaded data in Redux (lost on app kill, since not persisted). This is acceptable for the dummy/MVP phase.
- **Phase 2 (later, if required):** introduce an offline queue for the **assessment save/submit** path only (the write-heavy flow): persist drafts locally, queue answers, flush on reconnect. Keep reads online-first. This is additive and does not change the UI.
- **Draft safety:** until offline persistence exists, surface a “draft not submitted” reminder if the user backgrounds mid-assessment (reuse a toast); the upsert `saveAnswer` already persists each answer server-side, so per-question progress isn't lost once saved.

---

## 21. Performance & scalability

Extends Part I §8.
- **Lists at scale:** `FlatList` + `getItemLayout` + `keyExtractor`; **paginate** assignments and history (`page/limit` like the farm/field list endpoints already support) - design the repository + thunks to accept `page` from day one so the real API drops in.
- **Selectors:** stable empty constants + structural selectors prevent re-renders on absent data.
- **Memoization:** `React.memo` on row components (FarmCard/FieldCard already memoized); `useCallback`/`useMemo` for handlers/derived lists; reuse `assessmentPresenter` adapters.
- **Re-fetch discipline:** copy the **fetch-guards** added to the farmer detail screens (fetch only when the loaded id ≠ target id; lists fetch only when empty; pull-to-refresh for manual reload).
- **Images:** evidence via existing `AppImagePicker` (cap 5, size guard, temp cleanup); thumbnails lazy in History.
- **Scalability vectors to keep in mind:** many assigned farmers, farms with many fields, long history → pagination + virtualization; many categories/questions → the assessment screens already handle this for farmers.

---

## 22. Testing checklist

**Unit (pure):**
- [ ] Mappers (`mapAssignedFarmer`, `mapHistoryItem`) Raw→Domain incl. null/empty fallbacks.
- [ ] Reducers: pending/fulfilled/rejected for each thunk; `logout` resets to initial; stale-guard drops previous list.
- [ ] Selectors: return stable empty constants; never throw on absent data.

**Component:**
- [ ] Each assessor screen renders **loading / empty / error / loaded** states.
- [ ] QuestionDetail renders **read-only when `locked`** (ScoreSelector/picker disabled, no Save).
- [ ] Role gate: farmer sees farmer tabs; assessor sees assessor tabs.

**Integration / flow:**
- [ ] Dashboard → Farmers → FarmerDetail → FarmDetail → Assess → Summary → Question → Review → Submit → record locked + stamped “By Assessor”.
- [ ] History grouped by farmer; tap → read-only summary.

**Manual QA matrix:** iOS + Android · empty data · network failure · token expiry (silent refresh) · back-navigation preserves state · pull-to-refresh.

---

## 23. Future backend integration notes

When the backend exposes assessor endpoints, integration is a **per-function source swap** (§16). Expected contract (mirror of the farmer's owner-scoped routes, scoped to *assigned* instead of *owned* - see `ASSESSOR_APP_BUILD_GUIDE.md` §3.4):

```
GET  /assessor/assignments?status=
GET  /assessor/farmers/:farmerId/farms
GET  /assessor/farms/:farmId/fields                       (+ per-field assessor-assessment status)
GET  /assessor/fields/:fieldId/summary
GET  /assessor/fields/:fieldId/categories/:categoryId/questions(/list|/:questionId)
PUT  /assessor/fields/:fieldId/questions/:questionId/answer   (upsert)
GET  /assessor/fields/:fieldId/review
POST /assessor/fields/:fieldId/submit                     (locks; stamps submittedBy=assessor)
GET  /assessor/history?farmerId=
```
- **Auth/scoping:** assessor JWT; server must authorize by `assessor_assignments` (the assessor may only touch assigned farmers' fields). Submitting writes a **separate** assessment record with `submitted_by = assessor_id`.
- **Add `Endpoints.assessor.*`** (commented `// not yet live`) so paths are ready.
- **Maintain `docs/BACKEND-GAPS.md`** listing these endpoints for the backend team. **Do not implement them in the app or backend.**

---

## 24. Edge cases & risks (handle in the dummy phase too)

- No assignments → Farmers empty state; Dashboard counts all zero.
- Assigned farmer with **no farms** / farm with **no fields** → respective empty states (not errors).
- Field already **assessed by you** → “View (read-only)”; **not assessed** → “Assess”. (Independent of the farmer's own record.)
- **Two records per field** (By Farmer + By Assessor) - never merge/compare; show both in History with distinct chips.
- Submit on an **incomplete** assessment → block + message (mirror farmer submit guard).
- **Locked record reopened** → fully read-only; no Save; no score change.
- **Token expiry mid-session** → silent refresh; if it fails → forced logout (handled by `http`).
- **Role changes** (rare) → on next login the tab set re-resolves from `role`.
- **Network failure mid-assessment** → per-answer upsert means saved answers persist; unsaved current answer needs re-entry (online-first caveat, §20).
- **Large lists** → pagination/virtualization (§21).
- **Evidence upload failure** → existing `AppImagePicker`/save error handling; don't lock the form.

---

## 25. Consolidated code-reuse matrix

| Existing asset | Reused by assessor screen(s) | Change |
|---|---|---|
| `AppHeader`, `Button`, `AnimatedTabBar`, `AppText`, `AppTextInput`, `EmptyState` | all | none |
| `FarmCard` | Farmers, FarmerDetail, History rows | data only |
| `FieldCard` | FarmDetail | + status chip + Assess CTA |
| `FarmSummaryCard`, `StatCard`, `InfoRow`, `SectionHeader`, `Timeline`, `StatusBadge` | Dashboard, FarmerDetail, FarmDetail | data only |
| `FieldChips`, `FieldMapView` | FarmDetail (optional) | read-only |
| `AssessmentScreen`, `AssessmentCategoryScreen`, `AssessmentQuestionDetailScreen` | Assessment flow | **verbatim** (data source swapped) |
| `ScoreSelector`, `QuestionHeader`, `QuestionFooter`, `AssessmentSummaryCard`, `CategoryProgressList`, `QuestionCard`, `CategorySummaryCard` | Assessment flow | none |
| `AppImagePicker`, `AppDatePicker` | Question form | none |
| `MoreScreen`, `ProfileScreen`, `EditProfileScreen`, `ChangePasswordScreen` | More/Profile | none |
| `CustomTabBar`, `AppDrawer`, `drawerConfig` | shell | + ICONS/tabToModule entries |
| `handleApiError`, `http`, `toastService`, `errorService`, `useFormValidation` | data/forms | none |

---

## Documentation Review (Senior React Native Architect)

**1. Overall documentation score:** **9.2 / 10** *(after this appendix; ~7.0 before - strong plan, but missing the operational/reference layer a team needs to execute confidently).*

**2. Missing sections (now added in Part II):** redux data‑flow diagrams (§15), repository→API→mapper→domain + migration table (§16), data‑model relationships (§14), screen responsibility matrix (§13), state spec (§17), error‑handling strategy (§18), UX‑states matrix (§19), offline/sync (§20), testing checklist (§22), scalability (§21), future backend contract (§23), edge cases (§24), and a consolidated reuse matrix (§25).

**3. Weak sections (improved/clarified, not rewritten):**
- *Folder plan (§6)* - strong, now complemented by the layered architecture (§11) and reuse matrix (§25).
- *Assessment data ownership (§4.2)* - the “reuse `assessmentSlice` vs parallel slice” decision is now reinforced by the data model (§14: two records per field) and the migration path (§16); keep it as an explicit Open Decision (§10.2).
- *Offline/sync* - Part I omitted it; §20 sets realistic expectations (online‑first now, queue later).

**4. Suggested improvements (optional, non‑blocking):**
- Lock the four Open Decisions (§10) before Phase 2 - they affect slice shape.
- Create `docs/BACKEND-GAPS.md` now (one short list) so the backend team can start in parallel (§23).
- Add a tiny seed-data fixture spec to the repository task so QA has deterministic data.
- Consider a `useRole()` hook wrapping `selectAuthUser().role` for readability at the branch point.

**5. Final production‑readiness score (of the PLAN, not code):** **9 / 10.** The plan is execution‑ready: layering, navigation, reuse, state, errors, states, performance, testing, and the dummy→real path are all specified against the real codebase. The remaining point is recovered once the four Open Decisions are confirmed and `BACKEND-GAPS.md` is filed. No code, backend, business‑logic, or UI changes were introduced - documentation only.
