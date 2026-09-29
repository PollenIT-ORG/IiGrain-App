# 13 — Security, Data Isolation and Multi-User

---

## 1. What the app stores today

| Data | Where | Protection |
|---|---|---|
| Access + refresh tokens | Keychain (iOS) / Keystore-backed (Android), via `react-native-keychain` 10.0.0, services `com.iigrain.auth.token` / `com.iigrain.auth.refresh` | Hardware-backed where available. Correct. |
| User profile (name, email, phone, role, avatar URL) | AsyncStorage via `redux-persist` key `user` | Plain file in app-private storage |
| Assessment resume pointer | AsyncStorage (`assessmentProgress`) | same |
| Field boundaries | AsyncStorage (`boundary`) | same |
| Onboarding flags, incl. `enrollmentIdByEmail` | AsyncStorage (`onboarding`) | same |
| Selected farm id | AsyncStorage (`dashboard`) | same |
| Downloaded documents | `<Documents\|ExternalDir>/iiGrain/` | app-private files |

Tokens are handled well. Everything else is plaintext in app-private storage —
which is the normal RN baseline, but the offline project multiplies how much sits
there.

---

## 2. Sensitivity assessment of what SQLite would hold

| Data | Sensitivity | Notes |
|---|---|---|
| Farmer name, email, phone | **Medium — personal data** | Already persisted today |
| Farm/field names, areas, crops | Medium — commercial | A competitor's view of someone's operation |
| **Farm/field GPS coordinates and boundary polygons** | **High** | Precisely locates a private agricultural property. The most sensitive dataset in the app |
| Assessment answers and comments | **Medium–High — commercial** | Practices, scores, free-text notes; feeds certification/programme eligibility |
| Evidence photos | Medium–High | May show the property, equipment, people |
| Soil results, monitoring records | Medium — commercial | |
| Programme enrolment | Medium | |
| Dashboard/RHI snapshots | Medium | Derived scores |
| Assessor's assigned farmer list | **High** | Third-party personal data on the assessor's device — an assessor holds data about *other people* |
| Tokens | **Critical** | Stay in Keychain, never in SQLite |
| Passwords / OTPs | **Critical** | Never stored, anywhere. Keep it that way |

The assessor case deserves a line of its own: an assessor's device would hold
names, farm locations and assessment answers for **many farmers**. That is a
materially different privacy posture from the farmer's own device.

---

## 3. Is SQLite encryption necessary?

**Baseline first.** On both platforms the DB file lives in app-private storage:

* Android: `/data/data/<pkg>/` — unreadable by other apps; full-disk / file-based
  encryption is on by default from Android 6/7 **when a screen lock is set**.
* iOS: app container, protected by Data Protection (`NSFileProtectionComplete`
  class by default for most files) when a passcode is set.

So on a non-rooted, non-jailbroken, lock-screen-enabled device, the data is already
encrypted at rest by the OS. Application-level encryption adds protection against:
rooted/jailbroken devices, `adb backup`-style extraction on older/misconfigured
devices, forensic extraction, and devices with no lock screen.

### Recommendation

**Tiered, and decided by the business, not by engineering alone.**

* **Phase 1 (default): no SQLCipher.** OS-level protection plus app-private storage
  is the standard, proportionate baseline for this data class, and it keeps the
  build simple. **Choose op-sqlite anyway** (`03`), because SQLCipher is available
  there as a compilation target — the decision stays reversible without a library
  migration.
* **Upgrade to SQLCipher if any of these becomes true:**
  * a customer/programme contract requires encryption at rest;
  * assessors carry multi-farmer data at scale (the §2 case);
  * GDPR/DPA obligations are asserted over the farmer PII;
  * the app is deployed to shared or company-owned devices.
* If SQLCipher is adopted, the passphrase must be a **random key stored in
  Keychain/Keystore**, generated on first run — never derived from the user's
  password (they can change it, and the DB must survive that) and never hardcoded.

`REQUIRES PRODUCT DECISION.`

### Costs of encryption to state up front
* ~5–15% read/write overhead (negligible at this data volume).
* The DB is unreadable during debugging without the key — add a dev-only plaintext
  mode or a key dump behind `__DEV__`.
* Key loss = data loss. Keychain wipes (some OEM behaviours, restore-to-new-device
  scenarios) would orphan the DB; the app needs a "cannot open the local database"
  recovery path that clears and re-pulls rather than crash-looping.

---

## 4. What must never go into SQLite

* Access or refresh tokens — Keychain only.
* Passwords, OTP codes, reset codes — not persisted at all.
* Anything from `PUBLIC_AUTH_PATHS` request bodies.
* Full API response bodies containing tokens.

Add a lint-level rule or a code-review checklist item for this; it is the kind of
thing that leaks in accidentally via "just cache the whole response".

---

## 5. Logout behaviour

### Today
`logoutThunk` (`redux/slices/authSlice.ts`) clears the Keychain, closes the socket,
dispatches `logout`, and every slice resets via `.addCase(logout, () => initialState)`.
Persisted slices are reset because their reducers reset. Downloaded documents in
`iiGrain/downloads/` are **not** cleared today.

### With SQLite — the hard question

**A logout with a non-empty `sync_queue` destroys unsynced work.** This is the
single most dangerous interaction in the whole design.

Recommended behaviour:

```
on logout request:
    pending = count(sync_queue where status != 'done' and owner_user_id = me)
    if pending > 0 and online:
        offer "Sync now, then sign out"  (recommended default)
    if pending > 0 and offline:
        BLOCK the plain logout. Show:
          "You have N unsent changes. Signing out will delete them permanently."
          [ Stay signed in ]  [ Sign out and delete ]   ← destructive, explicit
    if pending == 0:
        proceed
```

Then, on confirmed logout:

| Data | Action | Why |
|---|---|---|
| Keychain tokens | clear | as today |
| `sync_queue` for that user | delete | it can never be flushed without the session |
| `media_files` + `outbox/<user>/` | delete | orphaned binaries |
| Cached entity rows for that user | **decision point** — see §6 | |
| `users` row for that user | keep the id + email | enables the fast-path re-login |
| Another user's rows | never touch | |

`deleteAccountThunk` must be unconditional and total: purge every row and file for
that `owner_user_id`, queue included, no "sync first" prompt. Account deletion is a
deletion request.

---

## 6. Multi-user on one device

### Is it possible today?
Yes. `logout` → `login` as anyone. Nothing prevents Farmer A logging out and Farmer
B logging in on the same handset, and this is realistic for shared/field devices and
for assessors testing against farmer accounts.

### Is it safe today?
Mostly, by accident: almost nothing is persisted, and what is persisted is wiped by
the `logout` reducer. There is one existing guard worth noting —
`authSlice`'s profile matcher checks `state.user.id !== action.payload.id` before
merging, i.e. the codebase already worries about cross-user bleed.

### With SQLite, "wipe everything on logout" stops being acceptable
If logging out wipes the DB, then a farmer who signs out loses their entire offline
cache and must re-download everything. On a rural connection that is a real cost.

### Recommended model: **scope, don't wipe**

```
every table carries owner_user_id
every query is filtered by the active owner_user_id
app_meta.active_user_id names the current session
logout clears the session + queue + media, but MAY retain read-only cached rows
```

Retention policy for cached rows after logout — `REQUIRES PRODUCT DECISION`:

| Option | Pros | Cons |
|---|---|---|
| **A. Retain per-user cache indefinitely** | Instant re-login, no re-download | Farmer A's farm names/GPS stay on a device Farmer B is now using — recoverable only by rooting, but still present |
| **B. Retain for N days, then purge** | Balanced | Needs a purge job |
| **C. Purge everything on logout** | Cleanest privacy | Expensive re-download; punishes the common case (same user signing back in) |

**Recommendation: B, with N = 30 days, and C on an explicit "Sign out and remove my
data from this device" option.** Always purge queue + media on logout regardless of
the option chosen; those are the parts that can cause *wrong* behaviour rather than
just stale storage.

### Shared-device reality
Farmers may share a phone within a family or cooperative. The mitigation is not
technical isolation between OS users (impossible in one app) but:
* per-user row scoping (above),
* never showing another `owner_user_id`'s rows even for a moment during login,
* and a clear "Sign out and remove my data" affordance.

---

## 7. Concrete risks to record

| Risk | Severity | Mitigation |
|---|---|---|
| Unsynced work destroyed by logout | **High** | §5 guard — block/warn, never silent |
| Farm GPS + boundaries readable on a rooted device | Medium | SQLCipher if the business requires it (§3) |
| Assessor device holds many farmers' PII | **Medium–High** | Cache only the assigned work list; purge on unassignment; shorter retention for assessors |
| Cross-user data bleed via a missing `owner_user_id` filter | **High** (correctness *and* privacy) | Filter in a single repository layer, never in screens; add a test that asserts every query is scoped |
| Restored backup resurrects another install's queue | Medium | `device_install_id` quarantine (`12`) |
| Tokens accidentally cached in a response snapshot | **High** | §4 rule + review checklist |
| Device with no lock screen → no OS encryption | Medium | Out of the app's control; SQLCipher is the only answer |
| "Clear storage" on Android wipes the DB but not the Keychain | Medium | Handle "token present, DB empty" by re-pulling, not by crashing |
