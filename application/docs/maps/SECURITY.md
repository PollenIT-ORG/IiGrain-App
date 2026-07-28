# SECURITY — API keys, restrictions, rotation

Read this before every release. Google Maps keys are **billing credentials**: a
leaked, unrestricted key is somebody else's traffic on your invoice, and the
first symptom is usually the bill.

---

## 1. Why API keys are never hardcoded

A hardcoded key is compromised the moment it is written, for three independent
reasons:

1. **Git is forever.** Once committed, the key is in the history, in every clone,
   in every fork, and in every CI cache. Deleting the line does not remove it —
   `git log -p` still has it. Scanners (GitHub secret scanning, GitGuardian, and
   less friendly ones) crawl public *and* leaked private repositories
   continuously.
2. **The binary is not a secret.** An `.apk` is a zip: `unzip app.apk` and read
   `AndroidManifest.xml`. An `.ipa` is a zip: read `Info.plist`. Strings in
   compiled Swift/Kotlin are recoverable in seconds. **This means the key IS
   extractable from a shipped app no matter what we do** — which is exactly why
   §3 (restrictions) is the real defence, not secrecy.
3. **Environments cannot diverge.** A hardcoded key means dev, staging and
   production share one credential. A developer's debug build burning quota then
   takes production down, and you cannot revoke one without breaking all.

### What this project does instead

| Surface | Mechanism | Committed? |
|---|---|---|
| `.env` | The only place the key is typed | ❌ gitignored |
| `AndroidManifest.xml` | `${MAPS_API_KEY}` placeholder | ✅ (placeholder only) |
| `Info.plist` | `$(MAPS_API_KEY)` build setting | ✅ (placeholder only) |
| `ios/Config/Env.generated.xcconfig` | Generated at `pod install` | ❌ gitignored |
| `AppDelegate.swift` | Reads the plist; holds no literal | ✅ (no secret) |
| `android/app/build.gradle` | Reads `$MAPS_API_KEY` / `.env` | ✅ (no secret) |

**Invariant: no committed file contains a key.** Verify with §8.

---

## 2. Git hygiene

Already in `.gitignore`:

```gitignore
.env
.env.*
!.env.example
ios/Pods/
ios/Config/Env.generated.xcconfig
```

Rules:

- `.env.example` must always have `MAPS_API_KEY=` **empty**.
- Never `git add -f` any of the above.
- Android build outputs (`android/app/build/`) contain the substituted key in
  the merged manifest. Already ignored — keep it that way.
- Do not paste keys into issue trackers, chat, screenshots of logcat, or CI logs.

---

## 3. Restricting the key

**This is the actual security control.** Since the key is extractable from the
binary (§1.2), restrictions are what make an extracted key useless to a thief.

Google Cloud Console → **APIs & Services → Credentials → your key**.

### 3.1 API restrictions (do this for every key)

**Restrict key → Restrict to selected APIs.** Enable *only*:

- Maps SDK for Android
- Maps SDK for iOS
- Directions API

Everything else off. A key that can only load maps cannot be used to run up
Places, Geocoding or Roads billing.

### 3.2 Application restrictions — Android

**Application restrictions → Android apps.** Add one entry per
package + certificate fingerprint:

| Build | Package name | SHA-1 source |
|---|---|---|
| Debug | `com.iigrain` | the debug keystore |
| Release (self-signed) | `com.iigrain` | your upload keystore |
| Play Store | `com.iigrain` | **Play Console → Setup → App signing → App signing key certificate** |

Get the debug fingerprint:

```sh
keytool -list -v -keystore android/app/debug.keystore \
        -alias androiddebugkey -storepass android -keypass android | grep SHA1
```

Get a release/upload fingerprint:

```sh
keytool -list -v -keystore your_key_name.keystore -alias YOUR_ALIAS | grep SHA1
```

> **The Play App Signing trap.** If Google re-signs your app (Play App Signing,
> which is the default), the fingerprint of the installed APK is **Google's**,
> not your upload key's. Registering only the upload SHA-1 gives you maps that
> work perfectly in internal testing and are **blank for every Play Store user**.
> Always register the *App signing key certificate* SHA-1 from the Play Console.

### 3.3 Application restrictions — iOS

**Application restrictions → iOS apps.** Add the bundle identifier:

```
com.amitbaser.iigrain
```

Add every variant you ship (e.g. a `.staging` suffix if one is introduced).

### 3.4 Why package-name and SHA-1 restrictions work

The SDK sends the caller's package name and signing-certificate fingerprint with
every request. Google rejects requests where they do not match the registered
pair. An attacker who extracts the key cannot use it without also possessing your
private signing key — which is what actually needs protecting.

---

## 4. One key per environment

| Environment | Key | Restrictions | Quota |
|---|---|---|---|
| Development | `iigrain-mobile-dev` | Debug SHA-1 + debug bundle id | Low daily cap |
| Staging | `iigrain-mobile-staging` | Staging SHA-1 / bundle id | Moderate cap |
| Production | `iigrain-mobile-prod` | Play signing SHA-1 + prod bundle id | Alerted, not capped |

The mechanism is already in place: CI sets `$MAPS_API_KEY`, which takes
precedence over any `.env` in both the Gradle and CocoaPods readers. Nothing in
the code needs to change per environment.

---

## 5. The Directions API problem

> **⚠️ This is the one genuine weakness in the current design. Read it before
> you ship.**

Google restrictions come in two incompatible flavours:

| Restriction type | Works for | Does **not** work for |
|---|---|---|
| Android app / iOS app | **SDKs** (Maps SDK for Android/iOS) | Web service APIs |
| IP address / HTTP referrer | Web service APIs | Mobile clients (no fixed IP) |

The **Directions API is a web service API**. It cannot be restricted by package
name or bundle id. So the key used by
`src/maps/services/directionsService.ts` — which runs in JavaScript, on the
device — **cannot be locked to this app**.

### Mitigations, in order of preference

1. **Proxy it through our own backend.** `GET /maps/directions?origin=…&destination=…`
   on the iiGrain API, with the key held server-side and never shipped.
   `directionsService.ts` was written for this: change the single
   `DIRECTIONS_BASE_URL` constant and the response shape is already Google's, so
   the proxy can pass it through untouched. **Tracked as the top item in
   [FUTURE_SCOPE.md](./FUTURE_SCOPE.md).**
2. **Until then: use a SEPARATE key for Directions**, restricted to the Directions
   API *only*, with a hard daily quota cap. A leaked Directions key then cannot
   touch SDK or Places billing, and the blast radius is one day of routing.
3. **Never reuse the SDK key for Directions**, and never leave a Directions key
   API-unrestricted.

Today the project uses `Env.MAPS_API_KEY` for both. Splitting the keys is a
`.env` change plus one constant — do it before public release.

---

## 6. Key rotation

Rotate when: a key is committed, a key appears in a log or screenshot, a
developer with access leaves, billing shows unexplained traffic, or on a routine
schedule (annually at minimum).

**Rotation is the response to a leak. Deleting the commit is not** — assume the
key was scraped within minutes of being pushed.

Procedure:

1. Create a **new** key in Cloud Console with identical API + application
   restrictions.
2. Update `.env` locally and the `MAPS_API_KEY` secret in CI.
3. Android: rebuild. iOS: `pod install` **then** rebuild — the xcconfig is only
   regenerated by `pod install`.
4. Ship, and wait for adoption. **Do not delete the old key yet** — installed
   apps still carry it and their maps go blank the moment it dies.
5. Watch the old key's usage graph in Cloud Console fall toward zero.
6. Delete the old key.

For an active compromise, invert steps 4–6: restrict the old key to a zero quota
immediately, accept that older installs lose maps, and force an app update.

---

## 7. Cost controls are a security control

An unbounded key is a denial-of-wallet vector. Configure all four:

1. **Budget alerts** — Cloud Console → Billing → Budgets & alerts. Alert at 50%,
   90% and 100% of the monthly expectation.
2. **Per-API daily quota caps** — APIs & Services → *(each API)* → Quotas. Cap
   Directions in particular; it is the unrestrictable one.
3. **Monitor the usage graph weekly.** A step change means a leak or a bug.
4. **Reduce billable calls in code.** Already done, and worth preserving:
   - `useRouteToDestination` throttles to 40 m / 8 s — a naive per-tick
     implementation would issue thousands of billed calls per visit.
   - Search and reverse geocoding use Nominatim (free), not Google Places.
   - Tiles are cached on disk by the SDK; we do not force reloads.

---

## 8. Pre-release security checklist

Run every item. Tick each one.

**Secrets**
- [ ] `git log -p --all -S "AIzaSy"` returns nothing.
- [ ] `git ls-files | xargs grep -l "AIzaSy"` returns nothing.
- [ ] `.env` is not tracked: `git ls-files --error-unmatch .env` fails.
- [ ] `.env.example` has `MAPS_API_KEY=` empty.
- [ ] `ios/Config/Env.generated.xcconfig` is not tracked.
- [ ] No key in any CI log, screenshot, or issue comment.

**Cloud restrictions**
- [ ] Production uses its own key, not the dev key.
- [ ] API restriction: exactly Maps SDK Android + Maps SDK iOS + Directions.
- [ ] Android restriction includes the **Play App Signing** SHA-1, not just the
      upload key.
- [ ] iOS restriction includes `com.amitbaser.iigrain`.
- [ ] A separate, quota-capped key is used for Directions (or the backend proxy
      has shipped — see §5).

**Cost**
- [ ] Budget alerts configured at 50 / 90 / 100%.
- [ ] Daily quota caps set on every enabled API.
- [ ] Usage graphs reviewed for the last 30 days; no unexplained steps.

**Build integrity**
- [ ] Release APK: `unzip -p app-release.apk AndroidManifest.xml` shows the
      production key, not empty, not a placeholder.
- [ ] Release IPA `Info.plist` shows the production key.
- [ ] Neither build shows a *development* key.

**Privacy**
- [ ] Location usage strings in `Info.plist` accurately describe the use.
- [ ] Coordinates are transmitted over HTTPS only (`NSAllowsArbitraryLoads` is
      `false` — confirmed).
- [ ] Release builds strip `console.*` (`transform-remove-console` is enabled in
      `babel.config.js`) so GPS coordinates never reach the device log.
- [ ] The Play Data Safety form and the App Store privacy nutrition label declare
      precise location collection.
