# 01 — Current Application Flow (as built today)

Everything here was read from source. Nothing is assumed. Paths are relative to `iiGrain/`.

---

## 1. Runtime bootstrap

`App.tsx` → `RootNavigator` (`src/navigation/RootNavigator.tsx`).

```
App.tsx
 └── Provider(store) → PersistGate → RootNavigator
                                      ├── dispatch(bootstrapThunk())
                                      ├── useProfileHydration()
                                      └── NavigationContainer
```

`bootstrapThunk` (`src/redux/slices/authSlice.ts:53`):

```
const token = await tokenStorage.get();
if (!token) return null;
try   { return await authApi.me(); }   // GET /auth/me
catch { await tokenStorage.clear(); return null; }
```

**This is offline blocker #1.** Any failure of `GET /auth/me` — including a plain
network failure — wipes the Keychain tokens and drops the user to the Auth stack.
A cold start with no connectivity logs the user out today.

`SPLASH.bootstrapTimeoutMs` lets the UI proceed after a timeout, but `status` is
still `unauthenticated`, so the Auth stack renders anyway.

---

## 2. Navigation tree (real)

```
NavigationContainer  (RootNavigator)
└── Stack
    ├── "Booting"  → SplashBackdrop            (until bootstrapped || timeout)
    ├── "Auth"     → AuthNavigator             (status !== 'authenticated')
    │    ├── Authentication      (login / signup)
    │    ├── Role
    │    ├── Otp
    │    ├── ForgotPassword
    │    └── ResetPassword
    └── "App"      → AppNavigator              (status === 'authenticated')
         │  useRealtimeSync()             ← socket.io owner
         │  useFarmerVisitWatch(!isAssessor)
         │
         ├── role === 'assessor' → AssessorNavigator
         │    ├── AssessorShell → AssessorTabNavigator
         │    │     ├── AssessorHome     (AssessorDashboardScreen)
         │    │     ├── AssessorFarmers  (AssessorFarmersScreen)
         │    │     ├── AssessorHistory  (AssessorHistoryScreen)
         │    │     └── AssessorMore     (AssessorMoreScreen)
         │    ├── AssessorFarmerDetail
         │    ├── AssessorFarmDetail
         │    ├── AssessorAssessmentSummary
         │    ├── AssessorCategory
         │    ├── AssessorQuestion
         │    ├── AssessorReview
         │    ├── AssessorFarmerAssessment
         │    ├── AssessorComparison
         │    ├── AssessorVisit
         │    ├── Notifications
         │    └── Account / Profile / EditProfile / ChangePassword
         │
         └── role !== 'assessor' → Farmer stack
              ├── Shell → AppDrawer → MainTabs (BottomTabNavigator)
              │     ├── Home        (screens/home/HomeScreen)      ← the real dashboard
              │     ├── Assessment  (screens/assessment/AssessmentScreen)
              │     ├── Farms       (screens/farms/FarmsScreen)
              │     ├── More        (screens/more/MoreScreen)
              │     └── EnrollNow   (screens/enroll/EnrollNowScreen)
              ├── OnboardingWelcome / OnboardingChecklist
              ├── Notifications
              ├── Account / Reports / Profile / EditProfile / ChangePassword
              ├── FarmDetails / FieldDetails
              ├── AddFarm / AddField
              ├── AssessmentFieldSummary
              ├── AssessmentCategory
              ├── AssessmentQuestionDetail
              ├── AssessmentReview
              ├── FarmerVisitTracking
              ├── BoundaryEditor
              ├── MonitoringModule / MonitoringRecord / MonitoringRecordForm
              └── Help / FieldMap / SimpleMap / AndroidLines   (help + dev screens)
```

Role is read once from `selectAuthUser().role` (`AppNavigator.tsx:44`). Role is
persisted only indirectly, inside `user.profile`; `auth.user` itself is **not**
persisted.

---

## 3. Data-fetch mechanism

There is exactly one fetch-orchestration primitive: `src/hooks/useSyncedFetch.ts`.

```
socket 'sync' event ──► tagsForSync(payload) ──► invalidateTags([...])
                                                       │
redux write thunk /fulfilled ──► WRITE_INVALIDATIONS ──┘
                                                       ▼
                                              sync.tags[tag]++  (a counter)
                                                       ▼
useSyncedFetch({ tags, run, hasData, ttlMs })
   • runs run() on first focus if !hasData or the tag stamp changed
   • re-runs when the stamp changes while focused
   • never re-runs merely because a screen was re-opened
```

Consequences for offline:

* Screens do **not** refetch on focus, so cached data would survive navigation.
* Nothing distinguishes "fetch failed" from "not fetched yet" — a rejected thunk
  leaves the slice at `null` and raises the global error toast.
* The socket is the only invalidation transport. While offline it is down; on
  reconnect `bumpSyncEpoch()` fires (`useRealtimeSync.ts:56`) and invalidates
  everything, so missed events are recovered by brute force. That behaviour is
  offline-friendly and must be preserved.

---

## 4. Persistence today (`src/redux/store.ts`)

| Slice | Persisted? | Whitelist |
|---|---|---|
| `auth` | ❌ | tokens live in Keychain, not redux |
| `user` | ✅ | `profile`, `lastFetchedAt` |
| `farm` | ❌ | — |
| `field` | ❌ | — |
| `fieldDetails` | ❌ | — |
| `monitoring` | ❌ | — |
| `soil` | ❌ | — |
| `assessment` | ❌ | — |
| `assessmentProgress` | ✅ | `resumeByField` (a resume pointer, not answers) |
| `assessor` | ❌ | — |
| `enrollment` | ❌ | — |
| `dashboard` | ✅ | `selectedFarmId` only |
| `visit` | ❌ | — |
| `notifications` | ❌ | — |
| `sync` | ❌ | — |
| `boundary` | ✅ | `byFieldId`, `pointsSeeded`, `drawTutorialSeen` |
| `onboarding` | ✅ | `enrollmentIdByEmail`, `registeredByEmail`, `dismissedByUserId` |

Engine: `AsyncStorage`, root key `iigrain.root`, `PERSIST_VERSION = 1`. The root
persist config whitelists nothing; only the per-slice configs persist.

**Net effect:** every list the farmer sees (farms, fields, dashboard,
assessments, monitoring, documents) is memory-only and empty on cold start.

---

## 5. Network layer (`src/services/http.ts`)

* axios instance, `baseURL = Env.API_BASE_URL`
  (default `https://api.farmer.tcqitsolution.com/api/v1`), `timeout` 15000 ms.
* Request interceptor attaches `Bearer` from Keychain and converts `FormData`
  bodies to `multipart/form-data`.
* Response interceptor:
  * **no `error.response`** (offline / DNS / timeout) → retries up to
    `MAX_RETRIES = 2` with 800 ms × n backoff, then falls through;
  * `401` → one refresh attempt via `/auth/refresh-token`, else `onUnauthorized()`
    → `logoutThunk()`;
  * everything else → `showError(error)` unless `config.silent`.

While offline, every screen fetch costs ~2.4 s of retries and then raises a global
error toast. Nothing suppresses this.

`src/utils/handleApiError.ts` already classifies a response-less failure as
`kind: 'offline'`, and `src/config/errorMessages.ts` already holds offline copy.
The classification exists; nothing acts on it.

---

## 6. Real-time layer

`src/services/socket.ts` — one socket.io client at `Env.API_HOST`, path
`/socket.io`, infinite reconnection. Owner is `useRealtimeSync()`, mounted once in
`AppNavigator`. Events consumed: `sync`, `notification:new`,
`notification:unread_count`, plus per-visit rooms.

---

## 7. Farmer end-to-end flow (traced)

```
Login (POST /auth/login) → tokens → Keychain
   ↓
GET /auth/me            (bootstrap, on every cold start)
GET /profile/me         (useProfileHydration → avatar/identity)
   ↓
Home  → GET /dashboard/my/farms → pick farm → GET /dashboard/my/farms/{farmId}
   ↓
Farms → GET /farms/me/farms (paged)
   ↓
AddFarm  → LocationPickerModal (GPS + Nominatim reverse geocode)
         → POST /farms/me/farms
   ↓
FarmDetails → GET /farms/{farmId}/fields
   ↓
AddField → LocationPickerModal + BoundaryEditor (draft ring)
         → POST /farms/{farmId}/fields   (boundary inlined as GeoJSON)
         → optional PUT /fields/{fieldId}/soil
   ↓
EnrollNow → GET /programs/my/available + GET /programs/my/fields
          → POST /programs/{programId}/enroll-self
   ↓
Assessment tab → GET /assessments/my/fields (pending) | /assessments/my/history
   ↓
AssessmentFieldSummary   → GET /assessments/my/programs/{p}/fields/{f}/summary
AssessmentCategory       → GET .../categories/{c}/questions/list
AssessmentQuestionDetail → GET .../categories/{c}/questions/{q}
        evidence: POST /assessments/evidence (multipart, must finish first)
        answer  : PUT  .../questions/{q}/answer
AssessmentReview         → GET .../review → POST .../submit
   ↓
FieldDetails → GET /fields/{id}/details (overview | activity | soil | documents)
Monitoring   → GET /field-monitoring/farms/{farmId}/fields
             → GET /field-monitoring/fields/{fieldId}/modules
             → GET/POST/PATCH/DELETE .../modules/{module}[/{recordId}]
             → POST .../documents (multipart)
```

## 8. Assessor end-to-end flow (assessment only)

```
Login → role 'assessor' → AssessorNavigator
   ↓
AssessorHome / AssessorFarmers → GET /assessor/fields
   ↓
Visit gate:  GET /visits/mine/assessor → visitSlice.activeVisit
             POST /visits (start) → status 'en_route' → socket → 'arrived'
   ↓
useAssessorAssessmentFlow computes `access` (useAssessorAssessmentFlow.ts:82):
     no activeVisit                → 'no_visit'    (locked)
     activeVisit for another field → 'other_field' (locked)
     activeVisit status en_route   → 'en_route'    (locked)
     arrived on this field         → 'open'
   ↓
AssessorAssessmentSummary → GET /assessor/programs/{p}/fields/{f}/summary
AssessorCategory          → .../categories/{c}/questions/list
AssessorQuestion          → .../categories/{c}/questions/{q} ; PUT .../answer
AssessorReview            → .../review ; POST .../submit
```

The visit gate is a hard online dependency for the assessor today. See `06` and `09`.

---

## 9. Dead code found during the audit (do not build on it)

* `src/services/assessmentRepository.ts` + `src/data/assessmentCategoryDummy.ts`,
  `assessmentQuestionsDummy.ts`, `assessmentDummyData.ts`, `dummyFarms.ts`,
  `dummyFields.ts` — imported nowhere. Legacy in-memory mock repository.
* `Endpoints.assessor.categoryQuestionsFull` is declared but never called.
* The farmer equivalent (`.../categories/{c}/questions`, no `/list`) exists on the
  backend and is not in `Endpoints` at all. It matters a great deal — see `07` and `12`.
