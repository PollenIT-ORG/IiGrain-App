# iiGrain - Assessor Module · Implementation Analysis & Execution Blueprint

> **This is the build checklist.** It applies the 7-step pre-implementation process to the Assessor module and is the single doc to execute from. It is **grounded in the real codebase** (exact file paths). No code lives here - code is written phase-by-phase, gated by review.
>
> **Doc map:** `assessor-ui-markup.html` = visual flow · `ASSESSOR_APP_BUILD_GUIDE.md` = build brief · `ASSESSOR_PLAN.md` = deep architecture + reuse map (Parts I & II) · **this file = implementation analysis + phase plan + safety + final-output template.**
> Where deep detail already exists, this file **references** `ASSESSOR_PLAN.md §X` rather than repeating it.

---

## 0. Working agreement (the rules we build under)

**General:** never break the Farmer flow · never change working business logic unless asked · **prefer extension over modification** · reuse existing components · keep architecture consistent.

**Never:** rename existing interfaces/types/slices/screens/routes · modify working APIs · change backend contracts · introduce breaking changes · use `any` · duplicate components / business logic / API mapping / Redux logic · move files needlessly · change design tokens (colours/spacing/typography) · hardcode ids/urls/tokens · remove comments/docs · add unnecessary libraries · create new architecture when a pattern exists · call APIs inside screens/components · transform data inside UI · mix dummy data with live API logic.

**Always:** follow `Screen → Redux Thunk → API → Mapper → Domain → Redux → UI` · keep all response mapping inside API files · keep components presentational · keep Redux for state only · reuse helpers/utils/services/components · add proper TS types · keep files small + modular · follow existing naming · clean imports · remove dead code.

**Before modifying any file, ask:** (1) what exists? (2) can it be reused? (3) will this affect the Farmer flow? (4) is there a similar impl? (5) can I extend instead of modify? - If reuse is possible, reuse.

**If any existing functionality may be affected → stop and explain the impact before changing.**

---

## 1. Locked decisions (rule-derived)

| # | Decision | Choice | Why |
|---|---|---|---|
| 1 | Centre FAB (assessor) | **Hidden** | assessor has no single "create" entry; assessment opens from a field card |
| 2 | Assessment data path | **Parallel, isolated `assessorAssessmentSlice` + thin screens reusing components** | reusing the live `assessmentSlice` with dummy data would **mix dummy+live** and **modify farmer-critical code** - forbidden. This **supersedes `ASSESSOR_PLAN.md` §4.2/§10.2's earlier "reuse" suggestion.** |
| 3 | Browse data | **New `assessorSlice`** | the data is *another* farmer's farms, not "my farms" (`farmSlice`) - must not be conflated |
| 4 | Tab names | **Home · Farmers · History · More** | matches the markup; `Home`/`More` reuse existing, `Farmers`/`History` are additive |

---

## STEP 1 - Understand the feature

**Goal:** a role-gated **Assessor** experience (dummy data now), reusing the live Farmer UI so the two roles look identical. Two halves:
1. **Browse:** Dashboard → Assigned Farmers → Farmer Detail (farms + fields count) → Farm Detail (fields + "See more" + Assess CTA).
2. **Conduct assessment (independent):** assessor fills their **own** assessment of a field with the **same form** → review → **submit (locks)**; plus a **History** tab. A field may hold two records (By Farmer + By Assessor), independent. (Model: `ASSESSOR_PLAN.md §1, §14`.)

| Aspect | Detail |
|---|---|
| **Existing modules involved** | navigation, auth (role), redux store, component libraries, the assessment module (as component source + pattern) |
| **Files to MODIFY (additive only)** | `navigation/BottomTabNavigator.tsx`, `components/BottomTab/CustomTabBar.tsx`, `config/drawerConfig.ts`, `navigation/navigationTypes.ts`, `redux/store.ts`, `navigation/AppNavigator.tsx` |
| **Files that must NOT change** | all farmer screens (`HomeScreen`, `FarmsScreen`, `FarmDetailsScreen`, `FieldDetailsScreen`); the **entire live assessment module** (`AssessmentScreen`, `AssessmentCategoryScreen`, `AssessmentQuestionDetailScreen`, `assessmentSlice`, `assessmentApi`, `assessmentThunks`); `farmSlice`/`fieldSlice`/`FarmApi`/`FieldApi`; `authSlice`; `services/http`; `RootNavigator`; `AppDrawer` |
| **Architecture to reuse** | layered pattern, all presentational components, `mapFarm`/`mapField` + assessment mappers, `handleApiError`, `http` (later), `toastService`/`errorService`, `useFormValidation`, `assessmentPresenter`, design tokens (full matrix: `ASSESSOR_PLAN.md §25`) |

---

## STEP 2 - Impact analysis & risk

| Subsystem | Impact | Risk | Mitigation |
|---|---|---|---|
| Authentication | read-only `selectAuthUser().role` | **None** | no auth writes |
| Navigation | role branch in `BottomTabNavigator`; additive ICONS / tabToModule / routes | **Low** | branch **defaults to farmer** for any non-`assessor` role; assessor entries additive |
| Redux | register `assessorSlice` (+ `assessorAssessmentSlice`) | **Low** | additive reducers; not persisted; `logout` reset |
| Farmer flow | no farmer screen/slice/api touched | **None (direct)** | only shared nav files → see Navigation row |
| Assessment flow | **not** reused at slice/api level (isolated); components imported read-only | **None** to farmer assessment | parallel-isolated module (decision #2) |
| API layer | new `AssessorApi`/`AssessorAssessmentApi` → dummy repo; live APIs untouched | **None** | reuse mappers (no mapping duplication) |
| Components | reused as imports | **None**, unless `FieldCard` needs a status chip / CTA | if needed → **optional props with safe defaults**, farmer usage byte-identical |
| Shared utilities | reused read-only | **None** | - |

**Risk register (must-watch):**
- **R1 - `BottomTabNavigator` role branch** (farmer-critical, shared). *Control:* additive; explicit `role === 'assessor'` check; default path = current farmer tab set; verified by "farmer login still shows farmer tabs".
- **R2 - Shared component prop change** (only if `FieldCard` needs status/CTA). *Control:* add **optional** props with defaults; never alter existing prop behavior.
- **R3 - Store registration** must be purely additive. *Control:* add reducer keys only; touch no existing config; not persisted.
- **R4 - dummy/live mixing.** *Control:* decision #2 - assessor assessment is a **separate** slice/api; the live assessment module is never imported for data, only for components.

---

## STEP 3 - Search-before-create (reuse inventory)

**Exists → reuse (do NOT recreate):** all UI components (`ASSESSOR_PLAN.md §25`); `mapFarm`/`mapField` + assessment mappers; `handleApiError` + `StandardizedError`; `http` (bearer/refresh/global-error); the dummy-data pattern (`data/dummyFarms.ts` style); `assessmentPresenter` adapters; `useFormValidation`; slice/thunk/structural-selector conventions; `AppDatePicker`/`AppImagePicker`; `toastService`/`errorService`.

**Create (assessor-only, nothing duplicated):** `types/assessor.ts`, `data/assessorRepository.ts`, `api/AssessorApi.ts` (+ `AssessorAssessmentApi.ts`), `redux/slices/assessorSlice.ts` (+ `assessorAssessmentSlice.ts`), `redux/thunks/*`, `screens/assessor/*`.

---

## STEP 4 - Implementation plan (phased, file-level)

Each phase is independently shippable, ends `tsc`-clean, and is reviewed before the next.

### Phase 1 - Role skeleton (smallest safe slice)
| | |
|---|---|
| **Create** | `screens/assessor/AssessorDashboardScreen.tsx` (+Style) + 3 placeholder screens (Farmers/History; FarmerDetail/FarmDetail can be stubs) |
| **Modify** | `BottomTabNavigator.tsx` (role branch, default farmer) · `CustomTabBar.tsx` (ICONS for `Farmers`/`History`, hide FAB for assessor) · `drawerConfig.ts` (tabToModule) · `navigationTypes.ts` (assessor tab keys + `AssessorFarmerDetail`/`AssessorFarmDetail` routes) · `AppNavigator.tsx` (register detail routes) |
| **Reason** | prove the role gate with zero farmer-flow risk |
| **Expected output** | login as assessor → 4 assessor tabs; login as farmer → identical to today; `tsc` clean |

### Phase 2 - Data spine (browse)
| | |
|---|---|
| **Create** | `types/assessor.ts` · `data/assessorRepository.ts` (seed) · `api/AssessorApi.ts` (calls repo; `// TODO(backend)` notes) · `redux/thunks/assessorThunks.ts` · `redux/slices/assessorSlice.ts` (+ selectors) |
| **Modify** | `redux/store.ts` (register reducer) |
| **Reason** | full layered data path for browse, dummy-backed |
| **Expected output** | selectors return dummy data via `Screen→Thunk→API→Mapper→Domain→Redux→UI` |

### Phase 3 - Browse UI
| | |
|---|---|
| **Create** | flesh out `AssessorDashboard/Farmers/FarmerDetail/FarmDetail` + styles (clone layouts; reuse `FarmCard`/`FieldCard`/`StatCard`/`FarmSummaryCard`/`SectionHeader`/`InfoRow`/`EmptyState`/`AnimatedTabBar`) |
| **Modify** | none beyond Phase 1 (use optional `FieldCard` props only if required, per R2) |
| **Reason** | the visible browse flow, identical look |
| **Expected output** | Dashboard→Farmers→Farmer→Farm renders with loading/empty/error states |

### Phase 4 - Assessment (isolated)
| | |
|---|---|
| **Create** | `api/AssessorAssessmentApi.ts` (reuses assessment mappers) · `redux/thunks/assessorAssessmentThunks.ts` · `redux/slices/assessorAssessmentSlice.ts` · thin `screens/assessor/assessment/*` reusing `ScoreSelector`/`QuestionHeader`/`QuestionFooter`/`AssessmentSummaryCard`/`CategoryProgressList`/`QuestionCard`/`AppImagePicker` |
| **Modify** | `redux/store.ts` (register) |
| **Reason** | conduct + lock the assessor's own assessment **without touching farmer assessment** |
| **Expected output** | Assess → Summary → Question → Submit → locked/read-only + "By Assessor" |

### Phase 5 - History
| | |
|---|---|
| **Create** | `AssessorHistoryScreen.tsx` (+Style) |
| **Modify** | - |
| **Reason** | read-only records grouped by farmer |
| **Expected output** | grouped list → tap → reused read-only summary |

### Phase 6 - Polish & optimise
| | |
|---|---|
| **Create/Modify** | apply fetch-guards, `getItemLayout`, memoisation, finalize empty/error states |
| **Reason** | production readiness |
| **Expected output** | `tsc` clean, no dead code, no redundant fetches |

**Totals:** modify **6 shared files (additive)**; everything else is **new**.

---

## STEP 5 - Architecture validation (no layer skipped)

```
Browse:
  AssessorFarmersScreen
   → dispatch(fetchAssignedFarmersThunk)
   → AssessorApi.getAssignedFarmers()        // mapping lives here only
        now:   assessorRepository.getAssignedFarmers()
        later: http.get(Endpoints.assessor.assignments) → mapAssignedFarmer
   → assessorSlice (pending/fulfilled/rejected)
   → selectAssignedFarmers
   → UI (presentational components)

Assess:
  AssessorQuestionScreen
   → dispatch(saveAssessorAnswerThunk)
   → AssessorAssessmentApi.saveAnswer()       // reuses SavedAnswer mapper
        now: assessorRepository  · later: http PUT /assessor/fields/...
   → assessorAssessmentSlice (optimistic progress)
   → selectQuestionDetail (locked-aware)
   → UI (ScoreSelector disabled when locked)
```
✅ Path holds for both halves. Screens never touch API/repo directly; mapping only in API files; components stay presentational; Redux holds state only.

---

## STEP 6 - Safety checklist (per phase, before merge)

- ✓ Farmer login → farmer tabs/screens identical to today.
- ✓ Live assessment flow (farmer) unchanged - no import of farmer assessment slice/api for data.
- ✓ Existing APIs unchanged; new api files only.
- ✓ Existing screens unchanged (assessor uses new/clone screens; reused components imported, not modified).
- ✓ Navigation stable; routes additive.
- ✓ Redux additive; not persisted; `logout` resets assessor state.
- ✓ Reusable components stay reusable (no breaking prop changes; additions optional with defaults).
- ✓ No `any`; `tsc` clean; clean imports; no dead code.

---

## STEP 7 - Final-output template (fill per phase)

> Paste this filled-in at the end of each phase.

1. **Files Created** - …
2. **Files Modified** - … (confirm each change is additive)
3. **Reused Components** - …
4. **Reused Logic** (mappers / helpers / hooks / patterns) - …
5. **Risks** - … (or "none; farmer flow verified unchanged")
6. **Testing Checklist** - see below.
7. **Production-Readiness Score** - _/10.

---

## Testing checklist (carry through all phases)

**Unit:** mappers (null/empty fallbacks) · reducers (pending/fulfilled/rejected, `logout` reset, stale-guard) · selectors (stable empty constants, never throw). 
**Component:** every assessor screen renders loading/empty/error/loaded · QuestionDetail read-only when `locked` · role gate (farmer↔assessor tabs). 
**Integration:** Dashboard→Farmers→Farmer→Farm→Assess→Summary→Question→Submit→locked "By Assessor" · History grouped → read-only. 
**Manual QA:** iOS + Android · empty data · network failure · token expiry (silent refresh) · back-nav preserves state · pull-to-refresh · **farmer regression pass**.

---

## Definition of done (whole module)

- [ ] Assessor login → Home · Farmers · History · More; farmer login unchanged.
- [ ] Browse flow visually identical to farmer screens (same components/tokens).
- [ ] Assessor conducts own assessment via reused components; submit → locks + "By Assessor".
- [ ] History grouped by farmer, read-only, By Farmer / By Assessor chips.
- [ ] All assessor data flows through `assessorRepository`/`AssessorApi*` (no nonexistent endpoint hit); auth/profile are the only live calls.
- [ ] No farmer code modified beyond the 6 additive nav/store touch points; no `any`; `tsc` clean.
- [ ] `docs/BACKEND-GAPS.md` lists the assessor endpoints the backend must add (`ASSESSOR_PLAN.md §23`).

---

### Ready state
Analysis complete, decisions locked (§1), risks identified & controlled (Step 2). **Next action on your word: implement Phase 1 only** (role-branch skeleton - farmer flow untouched, `tsc` clean), then stop for review with the Step-7 final output filled in.
