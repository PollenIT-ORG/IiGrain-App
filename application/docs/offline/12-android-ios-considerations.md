# 12 — Android and iOS Considerations

Verified project targets: Android `minSdk 24`, `target/compile 36`, NDK 27.1,
`newArchEnabled=true`, Hermes on. iOS deployment target **15.1**,
`use_frameworks!` only when `ENV['USE_FRAMEWORKS']` is set. RN 0.84.1.

---

## Android

### Network detection
* `@react-native-community/netinfo` uses `ConnectivityManager` +
  `NetworkCallback`. Reliable and near-instant on API 24+.
* `AndroidManifest.xml` already declares `INTERNET`. `ACCESS_NETWORK_STATE` is
  merged in by the NetInfo library's own manifest — no manual edit expected, but
  confirm after install.
* API 29+ metered/VPN reporting is good; `isConnectionExpensive` is trustworthy and
  worth using to defer large uploads (`11` §5).
* **Captive portals / dead backhaul** report `isConnected: true` with no usable
  route. Never trust a positive; only trust the negative (`09` §8).

### App lifecycle
* `onTrimMemory` / low-memory kills can take the process at any time. Every write
  must be committed to SQLite before the UI acknowledges it — never "save on
  unmount", never "save on blur".
* Configuration changes (rotation, dark mode, font scale) do not kill the process
  in RN, but **"Don't keep activities"** in developer options does. Test with it on.

### Background execution & sync
* Doze and App Standby buckets throttle background work aggressively from API 23+.
* API 26+ forbids most background services; API 31+ blocks starting foreground
  services from the background entirely.
* OEM battery managers (Xiaomi, Oppo, Vivo, Huawei, Samsung) kill background work
  far more aggressively than stock Android, and are common on the devices farmers
  actually carry.
* **Conclusion: do not build background sync on Android.** Sync on app foreground
  and on connectivity regain while the app is in the foreground. If a background
  path is ever wanted, `WorkManager` via a native module is the only defensible
  route — that is a separate project.

### Battery
* GPS with `enableHighAccuracy: true` is the main drain. The existing two-stage
  strategy in `currentLocation.ts` (low accuracy first) is already the right shape.
* An offline day means repeated GPS fixes without network assistance — slower and
  hungrier. Worth a "keep the phone charged" note in field guidance.

### Storage
* App-private paths (`RNFS.DocumentDirectoryPath`, `RNFS.ExternalDirectoryPath`)
  need **no permission** on any supported API level. The app already uses this
  (`fileDownloadService.ts`) and it must stay that way — do not introduce
  `MANAGE_EXTERNAL_STORAGE` or scoped-storage complexity.
* `ExternalDirectoryPath` can be on removable storage on some devices and can
  become unavailable. Prefer `DocumentDirectoryPath` for the **outbox** (must not
  vanish) and keep `ExternalDirectoryPath` for **downloads** (regenerable).
  `REQUIRES DECISION` at implementation time.
* The user can "Clear cache" (safe — outbox is not in cache) and "Clear storage"
  (destroys the DB, the outbox, and every unsynced write, with no warning from the
  OS). Nothing can prevent that; the app should detect an empty DB with a valid
  Keychain token and re-pull.
* Keychain entries survive "Clear storage" on some OEMs and not others — so
  "token present, DB empty" is a real state to handle.

### SQLite on Android
* Bundled system SQLite varies by API level. op-sqlite compiles its **own** SQLite
  by default, which removes that variance — an argument in its favour.
* WAL journal mode is strongly recommended (concurrent reads during a sync flush).
* Full-disk-encryption is on by default since Android 6 (FBE since 7), so the DB
  file already benefits from device encryption when a lock screen is set — see `13`.

### Permissions
Already declared and unchanged by this project: `INTERNET`, `ACCESS_FINE_LOCATION`,
`ACCESS_COARSE_LOCATION`, `CAMERA`, `RECORD_AUDIO`, `READ_MEDIA_IMAGES`,
`READ_MEDIA_VIDEO`, `READ_EXTERNAL_STORAGE` (maxSdk-capped).

---

## iOS

### Network detection
* NetInfo uses `NWPathMonitor`. Accurate, with the same captive-portal caveat.
* iOS has no equivalent to Android's "cleartext" restrictions to worry about here;
  ATS already forces HTTPS, which the API uses.

### App lifecycle — the important difference
* **iOS suspends the app within seconds of backgrounding** and can terminate a
  suspended app at any time with no callback. Android gives more warning in practice.
* Consequence: an in-flight upload or sync flush **will** be cut off when the user
  pockets the phone. Every queue entry must be safe to re-run from `queued` after an
  abrupt death — which is exactly why `in_flight` entries must be reset to `queued`
  on app start, and why idempotency (`10`) matters more on iOS than on Android.
* `beginBackgroundTask` buys ~30 seconds. Enough to finish one small PUT, not enough
  to flush a queue or upload a video. Optional nicety, not a strategy.

### Background execution & sync
* BGTaskScheduler / background fetch is opportunistic — iOS decides when, based on
  usage patterns, battery and charging state. It can be hours, or never for an app
  the user opens rarely.
* **Same conclusion as Android: foreground-only sync.** This is the one place where
  both platforms agree, which makes the decision easy and consistent.

### SQLite on iOS
* iOS ships SQLite in the system, but with `use_frameworks!` op-sqlite is forced onto
  the **embedded** system SQLite and needs the Podfile workaround from its docs. This
  project only enables `use_frameworks!` via `ENV['USE_FRAMEWORKS']`, so the default
  build is fine — but this must be checked into the build documentation, because
  anyone who sets that variable will hit it.
* The DB file lives in `Library/Application Support` or `Documents` depending on the
  library's default. Choose deliberately:
  * `Documents/` → backed up to iCloud, visible in Files if the app enables it;
  * `Library/Application Support/` → backed up, not user-visible; **recommended**.
  * `Library/Caches/` → **never**; iOS purges it under storage pressure.

### File storage
* `NSTemporaryDirectory()` (where the image picker writes) can be purged by the OS
  at any time — the reason for the outbox copy in `11` §2.
* iCloud backup: set `isExcludedFromBackup` on `downloads/` and leave `outbox/` and
  the DB backed up (`11` §3).

### App termination behaviour
* Force-quit by the user (swipe up) means the app receives nothing at all. There is
  no "flush on exit" hook on either platform. Write-through to SQLite is the only
  correct model.
* On next launch, the app must: reset `in_flight` → `queued`, reconcile
  `media_files` against the filesystem, and only then start a flush.

### Permissions
Already declared in `Info.plist` and unchanged: `NSCameraUsageDescription`,
`NSLocationWhenInUseUsageDescription`, `NSLocationAlwaysAndWhenInUseUsageDescription`,
`NSMicrophoneUsageDescription`, `NSPhotoLibraryUsageDescription`,
`NSPhotoLibraryAddUsageDescription`.

---

## Where the platforms differ (the list that matters)

| Concern | Android | iOS | Impact on this design |
|---|---|---|---|
| Process death without warning | Common under memory pressure | **Very common** on backgrounding | Write-through to SQLite; reset `in_flight` on launch |
| Background sync feasibility | Poor (Doze + OEM killers) | Poor (opportunistic BGTask) | Foreground-only sync on both — decision is easy |
| Time granted after backgrounding | Seconds to minutes, OEM-dependent | ~30 s via `beginBackgroundTask` | Never assume a flush completes in the background |
| Media temp directory volatility | Cache dir, evictable | `tmp`, purgeable at any time | Outbox copy is mandatory on both, more urgent on iOS |
| User can wipe app data | "Clear storage" wipes everything silently | Only via delete-app | Android needs the "token present, DB empty" recovery path |
| Removable/variable storage | `ExternalDirectoryPath` may be on SD | Single container | Prefer `DocumentDirectoryPath` for the outbox on Android |
| DB location pitfalls | none notable | `Library/Caches` gets purged | Pin the DB to Application Support on iOS |
| Backup of local DB | Auto Backup (can be disabled in manifest) | iCloud by default | Decide deliberately; a restored DB carries a stale `sync_queue` |
| SQLite build variance | System version varies by API | System version varies by iOS | op-sqlite compiling its own removes this on both |
| `use_frameworks!` SQLite conflict | n/a | Real, documented | Note in build docs |
| Location without network | Slower cold fix (no A-GPS) | Slower cold fix | Widen timeouts / copy on both |

---

## Restored-backup edge case (both platforms)

A device restore can bring back a **stale `sync_queue`** referencing rows and files
that no longer match the server, possibly for a different account. Guard on startup:

1. Compare `app_meta.device_install_id` with a freshly generated one; if it differs,
   the DB came from another install.
2. In that case, keep the **cached read data** but **quarantine the queue** — do not
   auto-flush. Show the user what is pending and let them confirm or discard.

This costs one column and prevents a whole class of "why did my old edits reappear"
incidents.
