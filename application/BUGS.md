# Bug Report - code audit + stabilization pass

Generated from a static code review of `application/src`, then resolved in a production-stabilization pass. Paths are relative to `application/`. Line numbers are approximate (they shift as code changes) - jump to the named symbol.

**Status legend:** ✅ Fixed · 📋 Reported (not changed, by design) · 🗑️ Removed

| # | Severity | Status | Area | File |
|---|----------|--------|------|------|
| 1 | 🔴 High | ✅ Fixed | Redux | src/redux/slices/fieldDetailsSlice.ts |
| 2 | 🟠 Med-High | ✅ Fixed | Screen | src/screens/farms/FarmDetailsScreen.tsx |
| 3 | 🟠 Med-High | ✅ Fixed | Screen | src/screens/assessor/AssessorQuestionScreen.tsx |
| 4 | 🟡 Medium | ✅ Fixed | Redux | src/redux/slices/assessmentSlice.ts |
| 5 | 🟡 Medium | ✅ Fixed | Screen | src/screens/assessment/AssessmentScreen.tsx |
| 6 | 🟡 Medium | ✅ Fixed | Screen | src/screens/assessment/AssessmentScreen.tsx |
| 7 | 🟡 Medium | ✅ Fixed | API | src/api/farmApi.ts |
| 8 | 🟡 Med-Low | ✅ Fixed | Redux | src/redux/slices/fieldSlice.ts |
| 9 | 🟡 Med-Low | ✅ Fixed | Screen | src/screens/farms/FieldDetailsScreen.tsx |
| 10 | 🟢 Low | 📋 Reported | Screen | src/screens/farms/FarmsScreen.tsx |
| 11 | 🟢 Low | ✅ Fixed | Component | src/components/assessment/EvidenceUploader.tsx |
| 12 | 🟢 Low | ✅ Fixed | Service | src/services/imagePickerService.ts |
| - | ⚪ Cleanup | 🗑️ Removed | Structural | src/src/ (duplicate tree) |
| - | Note | 📋 Reported | Redux | submit → myFields not synced |
| - | Note | 📋 Reported | Service | http.ts multipart boundary |

Verification after the pass: `tsc --noEmit` clean; ESLint clean on all fixed files (the two commented-out-WIP screens keep only their pre-existing scaffolding warnings).

---

## 🔴 High

### 1. Field-detail tabs could show ANOTHER field's data (persistent cross-field leak) - ✅ Fixed
- **File:** `src/redux/slices/fieldDetailsSlice.ts` - the per-tab + upload/delete reducers.
- **Cause:** `fulfilled`/`rejected` set the bucket without comparing the response's field to `state.fieldId`.
- **Fix:** each `fulfilled`/`rejected` now early-returns when `action.meta.arg !== state.fieldId` (upload/delete use `action.meta.arg.fieldId`). A late response for a field the user left can no longer overwrite the current field's data/error or prepend a doc to the wrong list.

---

## 🟠 Medium-High

### 2. History tab infinitely recursed → crash - ✅ Fixed
- **File:** `src/screens/farms/FarmDetailsScreen.tsx`
- **Cause:** `case 'history': return renderTab();` (self-recursion) → stack overflow when the tab bar is re-enabled.
- **Fix:** added `renderHistory()` (renders the existing `Timeline` with the existing `activity` data) and pointed the case at it. No current UX change (tab bar still commented). Also cleared the dead `Timeline`/`activity` imports.

### 3. Locked assessor assessment was editable; "Next" was broken - ✅ Fixed
- **File:** `src/screens/assessor/AssessorQuestionScreen.tsx`
- **Cause:** `<QuestionFooter>` was missing `readOnly`/`onNextQuestion` (unlike the farmer twin), so a submitted assessment showed edit buttons and "Next" only fired an error toast.
- **Fix:** added `readOnly={locked}` + a `handleNextQuestion` (read-only forward nav) + `onNextQuestion`. Locked assessments now show the "View only" footer with working prev/next.

---

## 🟡 Medium

### 4. Assessment summary/review could show the wrong field - ✅ Fixed
- **File:** `src/redux/slices/assessmentSlice.ts`
- **Fix:** added `requestedSummaryFieldId` + `requestedReviewFieldId` trackers (set in `pending`) and stale-drop guards in `fulfilled`/`rejected` - mirroring the existing `assessorSlice` pattern.

### 5. Stale field card + wrong-category navigation while switching - ✅ Fixed
- **File:** `src/screens/assessment/AssessmentScreen.tsx`
- **Fix:** `renderFieldSummary` now gates on the already-computed `summaryReady` (`summary.field.id === selectedFieldId`), so a previous field's card/categories can't flash or mis-navigate.

### 6. "Start Assessment" silently no-op'd for a revisited field - ✅ Fixed
- **File:** `src/screens/assessment/AssessmentScreen.tsx`
- **Fix:** the `fieldId` route param is consumed as a one-time signal - cleared via `navigation.setParams({ fieldId: undefined })` after selecting - so opening the same field again re-fires the effect. Tab-refocus behavior is unchanged.

### 7. `getMyFarms` crashed on an empty/null farms payload - ✅ Fixed
- **File:** `src/api/farmApi.ts` - `return (res.data.data.farms ?? []).map(mapFarm);`

---

## 🟡 Medium-Low

### 8. Farm fields list could briefly show the previous farm - ✅ Fixed
- **File:** `src/redux/slices/fieldSlice.ts` - `fetch`/`refresh` `fulfilled`/`rejected` now drop responses where `action.meta.arg !== state.farmId`.

### 9. FieldDetails transiently showed a field from the previous farm - ✅ Fixed
- **File:** `src/screens/farms/FieldDetailsScreen.tsx` - added `fieldsReady = fieldsFarmId === farmId`; `currentField` and the loading gate ignore another farm's cached list (spinner instead of a wrong field).

---

## 🟢 Low

### 10. Map tab opens the wrong field - 📋 Reported (not changed)
- **File:** `src/screens/farms/FarmsScreen.tsx`
- **Reason not changed:** the entire Map tab renders **dummy** data (`getFieldsByFarm`) and navigates with a dummy id. Fixing it is a feature-completion task (wire real fields + risk of single-farm `fieldSlice` contention), outside a "smallest safe change" stabilization pass. Fix when the Map is wired to the real fields API.

### 11. Seeded remote video evidence rendered as a broken image - ✅ Fixed
- **File:** `src/components/assessment/EvidenceUploader.tsx` - `kindFromUrl` now classifies `/video/` CDN paths as video before the extension check.

### 12. Empty-string filename produced an empty multipart `name` - ✅ Fixed
- **File:** `src/services/imagePickerService.ts` - `raw.filename?.trim() || deriveFileName(uri, source)`.

---

## ⚪ Cleanup / structural

- **Duplicate source tree `src/src/` (238 files) - 🗑️ Removed.** Verified zero inbound imports and zero references in `index.js`/`App.tsx`/`tsconfig`/`metro`/`babel`, then deleted.
- **submit → `myFields` not synced (`assessmentSlice.submit.fulfilled`) - 📋 Reported.** After submit, `summary`+`review` are patched but the "My Assessments" list keeps stale status until refresh. A correct fix must also recompute the aggregate `counts` bucket exactly as the backend does; a field-only patch would create a counts/list mismatch, so left for a scoped follow-up.
- **`http.ts` multipart `Content-Type` without boundary - 📋 Reported.** Unconfirmable statically and current uploads appear to work; changing it risks regressing working uploads - verify with a live upload test first.

---

## Remaining low-priority (pre-existing, untouched)
- **Lint scaffolding (5 warnings):** `AnimatedTabBar`/`TABS`/`setActiveTab` (FarmDetailsScreen) and `startAssessment`/`footerStyle` (FieldDetailsScreen) belong to **intentionally commented-out** tab-bar/footer blocks. Left in place so those features can be re-enabled; remove only if you drop the commented UI.

## Notes
- Fixes were verified by `tsc --noEmit` + ESLint (both clean on changed code). A device smoke-test of the runtime flows (rapid field/farm switching, submit→reopen a locked assessor question, empty-farms account) is recommended before release.
