# 16 — iOS Validation Guide (offline stack)

**Status: iOS is NOT validated.** All development so far has happened on Windows,
where `xcodebuild`, `pod` and the simulator do not exist. Everything below is
either (a) verified by static inspection of the installed packages, or (b) a step
someone must run on macOS.

Nothing here should be read as "iOS works". It means "no blocker was found, and
here is exactly how to prove it".

---

## 1. What was verified statically

| Check | Evidence | Result |
|---|---|---|
| op-sqlite ships iOS sources | `node_modules/@op-engineering/op-sqlite/ios/OPSQLite.{h,mm}`, `OPSQLite.xcodeproj` | ✅ |
| op-sqlite compiles its own SQLite | `cpp/sqlite3.c` present; no `op-sqlite` key in `package.json`, so defaults apply (vendored SQLite, no SQLCipher/libsql/turso) | ✅ same engine as Android |
| op-sqlite deployment target | podspec: `s.platforms = { :ios => min_ios_version_supported }` | ✅ tracks RN's floor |
| NetInfo ships iOS sources | `RNCNetInfo.mm`, `RNCConnectionStateWatcher.m` | ✅ |
| NetInfo deployment target | podspec requires iOS **14.0**; project targets **15.1** | ✅ |
| NetInfo New-Architecture path | podspec branches on `ENV['RCT_NEW_ARCH_ENABLED'] == '1'`; RN 0.84 sets it to `"1"` in `react_native_pods.rb:116` before podspecs resolve | ✅ takes `install_modules_dependencies` |
| Autolinking | `react-native.config.js` declares `ios: {}` with no exclusions | ✅ both pods autolink |
| Database location | `IOS_LIBRARY_PATH` = `NSLibraryDirectory` (read from `OPSQLite.mm`) → `Library/` | ✅ persistent; not `Caches/` (purged) |
| Platform-specific code | exactly one branch: `Platform.OS === 'ios' ? IOS_LIBRARY_PATH : ANDROID_DATABASE_PATH` | ✅ |
| `use_frameworks!` conflict | fixed — `pre_install` hook forces op-sqlite to `static_library`, scoped to the `USE_FRAMEWORKS` branch | ✅ mitigated |

---

## 2. Steps to run on macOS

```bash
npm install
cd ios && pod install          # first real resolution of op-sqlite + NetInfo
cd .. && npx react-native run-ios
```

`pod install` is the single highest-value step: the pod graph has never been
resolved, because `ios/Podfile.lock` and `ios/Pods/` are gitignored
(`.gitignore:27,57`). Any genuine incompatibility surfaces here first.

Expect the **first build after `pod install` to be slow** — the Podfile sets
`RCT_USE_PREBUILT_RNCORE = '0'`, so React Native core builds from source. That is
deliberate (it fixes Debug simulator link errors), not a fault.

---

## 3. Runtime checklist

Run the app, then verify in order. The database lives at
`<app container>/Library/iigrain.sqlite`.

| # | Check | Expected |
|---|---|---|
| 1 | App launches | no crash, no red box |
| 2 | DB opens | no `[db] initialization failed` in the Xcode console |
| 3 | Schema version | `PRAGMA user_version` → **3** |
| 4 | Journal mode | `PRAGMA journal_mode` → **wal** (init throws if not) |
| 5 | Foreign keys | `PRAGMA foreign_keys` → **1** (init throws if not) |
| 6 | Tables | 18, including `sync_queue` with 16 columns |
| 7 | Migration on an existing DB | install an older build first, then upgrade; queue rows must survive |
| 8 | Offline answer | airplane mode → answer a question → saved and queued |
| 9 | Offline read | reopen the question offline → the answer is visible |
| 10 | Restart | force-quit → reopen → answer and queue entry still present |
| 11 | Stale in-flight | leave an entry `processing` with an old `claimed_at` → relaunch → it returns to `pending` |
| 12 | Connectivity | offline → zero requests; restore network → queue flushes |
| 13 | Sync 401 | expired session → no forced logout, queue entry stays `pending` |

Inspecting the DB on a simulator:

```bash
xcrun simctl get_app_container booted com.amitbaser.iigrain data
# then: sqlite3 <that path>/Library/iigrain.sqlite "PRAGMA user_version;"
```

Note the iOS bundle id (`com.amitbaser.iigrain`) differs from Android
(`com.iigrain`) — this is pre-existing and intentional.

---

## 4. iOS-specific risks that remain unproven

1. **Data Protection while locked.** The DB is in `Library/`. If iOS applies
   `NSFileProtectionComplete`, SQLite reads/writes fail while the device is
   locked. Default is `…UntilFirstUserAuthentication`, which is fine.
   **Mitigated in code:** `App.tsx` retries database initialization whenever the
   app returns to the foreground, so a launch-while-locked failure self-heals
   instead of leaving the session permanently DB-less.
2. **Aggressive suspension.** iOS suspends within seconds of backgrounding, so a
   flush can be cut mid-request. Handled in principle by `in_flight` + the
   5-minute stale-claim recovery, and answer replay is idempotent server-side —
   but unproven on real iOS.
3. **`use_frameworks!` builds.** The Podfile fix is in place but has never been
   executed. If CI sets `USE_FRAMEWORKS`, confirm the `pre_install` hook runs and
   op-sqlite still compiles its vendored SQLite.
4. **Background flush.** Not implemented on either platform, by design.
5. **arm64 device build.** Android arm64 compiles; iOS device builds are
   arm64-only and unverified.

---

## 5. If something fails

* **`pod install` fails resolving op-sqlite or NetInfo** — report the resolver
  output. Do **not** downgrade either package blindly; NetInfo 11.x has no
  `codegenConfig` and would break under the New Architecture.
* **Build fails only with `use_frameworks!`** — confirm the `pre_install` hook in
  `ios/Podfile` is being applied.
* **DB opens but `journal_mode` is not `wal`** — initialization is designed to
  throw rather than continue. Capture the thrown message; do not relax the check.
