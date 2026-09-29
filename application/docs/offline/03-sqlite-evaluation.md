# 03 — SQLite Technology Evaluation

## Project constraints (verified from the repo)

| Constraint | Value | Source |
|---|---|---|
| React Native | **0.84.1** | `package.json` |
| React | 19.2.3 | `package.json` |
| New Architecture | **enabled** | `android/gradle.properties` → `newArchEnabled=true` |
| Hermes | enabled | `android/gradle.properties` → `hermesEnabled=true` |
| Android minSdk / target / compile | 24 / 36 / 36 | `android/build.gradle` |
| iOS deployment target | **15.1** | `ios/iiGrain.xcodeproj/project.pbxproj` |
| `use_frameworks!` | **conditional** — only when `ENV['USE_FRAMEWORKS']` is set | `ios/Podfile:32-36` |
| Expo | **not used** — bare RN, `@react-native-community/cli` 20.1.0 | `package.json` |
| Language | TypeScript 5.8.3, strict app conventions | `tsconfig.json` |
| State | Redux Toolkit 2.12 + redux-persist 6 + AsyncStorage 3.1.1 | `package.json` |
| Filesystem lib already present | `react-native-fs` 2.20.0 | `package.json`, `services/fileDownloadService.ts` |
| Secure storage already present | `react-native-keychain` 10.0.0 | `services/tokenStorage.ts` |

Two consequences that eliminate options immediately:

1. **Bare RN, no Expo.** Anything that requires the `expo` package pulls a whole
   module system into a project that has never had one.
2. **New Architecture is on.** Old-bridge-only native modules are a risk.

---

## Options evaluated

### Option 1 — `@op-engineering/op-sqlite`

```
Latest        18.1.4, published 2026-08-21   (npm registry)
Downloads     ~173k / week
Maintainer    OP Engineering (@ospfranco)
License       MIT
```

**Pros**
* JSI-based, synchronous C++ binding; no bridge serialisation. Benchmarks show it
  as the fastest of the RN SQLite options for bulk reads/writes.
* Ships without Expo. For bare RN, `pod install` is automatic on modern RN.
* Feature set covers everything this project could need and more: transactions,
  prepared statements, **SQLCipher as a compilation target**, FTS5, R-tree,
  JSONB, reactive queries, `db.interrupt()`, and a built-in key-value store.
* Released continuously through 2026, i.e. after RN 0.84 shipped.
* First-class TypeScript types.

**Cons**
* Large surface area — many compilation targets (Turso, libsql, SQLCipher,
  sqlite-vec) that this project will not use; you carry the config complexity.
* **`use_frameworks!` caveat**: the docs state `use_frameworks!` forces the
  compilation to use iOS' embedded SQLite, and a Podfile workaround is needed.
  This project only sets `use_frameworks!` when `ENV['USE_FRAMEWORKS']` is
  present, so the default build is unaffected — but anybody building with that
  env var set must apply the workaround.
* No migration framework included; you write your own `user_version` runner.
* Single-maintainer project (sponsorship-driven), which is a bus-factor risk.

**RN 0.84 / New Arch:** peer deps are `react-native: *`; the library is JSI/C++
and is used in bridgeless apps. Not *contractually* pinned to 0.84 — **verify with
a build spike before committing** (see Phase 1 in `14`).

---

### Option 2 — `react-native-nitro-sqlite`

```
Latest        9.7.0, published 2026-07-23
Downloads     ~18k / week
Peer deps     react-native >= 0.75, react-native-nitro-modules >= 0.35
Maintainer    Margelo
License       MIT
```

This is the official successor to `react-native-quick-sqlite`, which is now
**deprecated** and points users here.

**Pros**
* Explicit `react-native >= 0.75` peer range — the only candidate that states RN
  compatibility contractually.
* Backed by Margelo (a team, not one person) — better bus factor than op-sqlite.
* JSI/Nitro, comparable performance class to op-sqlite.
* Clean, small API.

**Cons**
* Requires **`react-native-nitro-modules`** as a second native dependency. That
  is a new native runtime layer in an app that currently has none, and it must
  itself be compatible with RN 0.84.
* ~10× lower adoption than op-sqlite → fewer answered edge cases.
* No SQLCipher story out of the box.
* Smaller plugin ecosystem.

---

### Option 3 — `expo-sqlite`

```
Latest        57.0.2, published 2026-08-26
Downloads     ~1.14M / week   (dominated by Expo apps)
Peer deps     expo: *
```

**Pros**
* By far the most used, best documented, JSI-based since v14, good sync API,
  prepared statements, solid transactions, and a maintained migration story.
* Maintained by Expo — the strongest maintenance guarantee of the three.

**Cons — decisive here**
* **Requires the `expo` package even in bare RN.** Adding Expo Modules to a bare
  RN 0.84 app with custom Podfile logic (the Google Maps xcconfig generation in
  `ios/Podfile`), patched packages (`patches/`), and a hand-managed
  `react-native.config.js` is a meaningful integration risk for zero functional
  gain.
* Ties the app's local-DB upgrade cadence to Expo SDK releases.

---

### Option 4 — `react-native-sqlite-storage`

```
Latest        6.0.1, published 2021-10-01
```

**Rejected.** No release in ~5 years, maintenance flagged inactive, New
Architecture support unknown, callback-based bridge API. Unsuitable for a
New-Architecture RN 0.84 app.

---

### Option 5 — no SQLite: extend `redux-persist` + AsyncStorage

Worth stating explicitly because it is the cheapest path.

**Pros**
* Zero new native dependencies. Would let Phases 1–3 (`14`) ship in days.
* The app already does this for `boundary` and `user.profile`.

**Cons**
* AsyncStorage serialises the whole slice on every write. An assessment with
  hundreds of answers, plus farms/fields/monitoring, means re-writing a large JSON
  blob on each keystroke-level save. This does not scale.
* No queries, no indexes, no transactions, no partial updates → an outbox on top
  of it is not durable in the way a queue must be.
* No way to atomically write "answer + queue entry" together.

**Verdict:** acceptable as a *stopgap* for read-only caching (Phase 3), not as the
offline-first source of truth.

---

## Comparison table

| | op-sqlite | nitro-sqlite | expo-sqlite | sqlite-storage | redux-persist |
|---|---|---|---|---|---|
| RN 0.84 compatible | Likely (verify) | Stated `>=0.75` | Yes (via expo) | Unknown | Yes |
| New Architecture | Yes (JSI) | Yes (Nitro) | Yes | Unknown | N/A |
| Android | ✅ | ✅ | ✅ | ⚠️ | ✅ |
| iOS | ✅ | ✅ | ✅ | ⚠️ | ✅ |
| Extra native dep required | none | `nitro-modules` | `expo` | none | none |
| TypeScript | ✅ | ✅ | ✅ | partial | ✅ |
| Transactions | ✅ | ✅ | ✅ | ✅ | ❌ |
| Prepared statements | ✅ | ✅ | ✅ | ❌ | ❌ |
| Migrations built in | ❌ (DIY) | ❌ (DIY) | partial | ❌ | versioned |
| Encryption (SQLCipher) | ✅ target | ❌ | ❌ | ❌ | ❌ |
| Large datasets | excellent | excellent | good | poor | poor |
| Weekly downloads | ~173k | ~18k | ~1.14M | ~35k | n/a |
| Last publish | 2026-08 | 2026-07 | 2026-08 | 2021-10 | n/a |
| Maintainer bus factor | 1 | team | company | 0 | — |

---

## Recommendation

**Primary: `@op-engineering/op-sqlite`.**

Reasoning, in the order that mattered:

1. It is the only strong option that adds **no second dependency** (no `expo`,
   no `nitro-modules`) to a bare RN app that has a hand-tuned Podfile and patched
   packages. Fewer moving parts in the native build is worth a lot here.
2. Performance headroom for the worst case in this app: prefetching a whole
   program's questions for many fields, then joining answers locally on every
   review render.
3. SQLCipher is available as a compilation target if the security review in `13`
   later demands encryption at rest — with the other options that decision would
   force a library migration.
4. It is actively released (Aug 2026) and widely adopted (~173k/week).

**Fallback: `react-native-nitro-sqlite`**, if the Phase 1 build spike shows
op-sqlite failing on RN 0.84 / New Architecture on either platform. It is the only
candidate with a contractual RN version range, and Margelo maintains it as a team.

**Mandatory gate before committing (Phase 1, `14`):** a throwaway build spike that,
on a real Android device and a real iOS device, opens a DB, creates a table, runs a
transaction of 1000 inserts, reads them back, and survives an app restart. Neither
library is *documented* as RN-0.84-verified, so the spike is the proof, not the docs.

Do **not** add an ORM (WatermelonDB, TypeORM, Drizzle, Prisma) on top. The schema in
`04` is ~12 tables with simple access patterns; hand-written SQL in a repository
layer is easier to reason about during sync debugging, and avoids a second
compatibility surface.

---

## Sources

- [op-sqlite (GitHub)](https://github.com/OP-Engineering/op-sqlite)
- [op-sqlite installation docs](https://op-engineering.github.io/op-sqlite/docs/installation)
- [react-native-nitro-sqlite (GitHub)](https://github.com/margelo/react-native-nitro-sqlite)
- [react-native-quick-sqlite — DEPRECATED, use nitro-sqlite](https://github.com/margelo/react-native-quick-sqlite)
- [expo-sqlite (npm)](https://www.npmjs.com/package/expo-sqlite)
- [Expo SQLite documentation](https://docs.expo.dev/versions/latest/sdk/sqlite/)
- [react-native-sqlite-storage (npm)](https://www.npmjs.com/package/react-native-sqlite-storage)
- [react-native-sqlite-storage package health](https://reactnative.solutions/packages/react-native-sqlite-storage)
- [RN database performance comparison (PowerSync)](https://powersync.com/blog/react-native-database-performance-comparison)
- [nitro-sqlite benchmarks](https://github.com/margelo/react-native-nitro-sqlite-benchmarks)
- [expo-sqlite vs op-sqlite](https://kerneldaily.com/articles/expo-sqlite-vs-op-sqlite/)

Version numbers, publish dates and download counts above were read directly from
the npm registry API on 2026-09-05, not from the articles.
