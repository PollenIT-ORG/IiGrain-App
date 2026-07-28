# Build the iiGrain iOS archive — instructions for Claude

**You are reading this because the user asked you to build an App Store /
TestFlight archive for the iiGrain React Native app.** Everything below is
verified — this exact recipe produced v2.0(2) and v2.0(3) successfully.
Follow it in order. Do not improvise around the constraints marked 🔴.

---

## Project facts

| | |
|---|---|
| App | iiGrain (React Native 0.84, New Architecture) |
| Workspace | `<PROJECT>/ios/iiGrain.xcworkspace` — **not** the `.xcodeproj` |
| Scheme | `iiGrain` — ⚠️ a stale `iiGrain 1` scheme also exists; never use it |
| Bundle ID | `com.amitbaser.iigrain` |
| Team | `SADMK33W84` |
| Toolchain | Xcode 26.2 · CocoaPods 1.16.2 (`/opt/homebrew/bin/pod`) · Node v25.6.1 |

`<PROJECT>` is one of these — **detect it, do not assume**:
- `/Users/patel/Desktop/TCQProjects/FarmerApp` (standalone working copy)
- `/Users/patel/Desktop/TCQProjects/farmer-app/application` (git monorepo; app lives under `application/`)

```bash
for p in /Users/patel/Desktop/TCQProjects/FarmerApp \
         /Users/patel/Desktop/TCQProjects/farmer-app/application; do
  [ -d "$p/ios/iiGrain.xcworkspace" ] && echo "FOUND: $p"
done
```
If both exist, **ask the user which one to build** — they are different
codebases and have diverged. Do not guess.

---

## 🔴 Hard constraints

1. **Xcode must be closed for the entire archive run.** Xcode and `xcodebuild`
   write the same DerivedData; running both corrupts the build and produces
   hundreds of bogus compile errors. This has already happened once and cost a
   full rebuild. Verify before starting *and* warn the user not to open Xcode
   until it finishes.
2. **You cannot do the upload.** Distribution to App Store Connect happens in
   Xcode's Organizer GUI. Build the archive, then hand off to the user with the
   click-path. Do not attempt `xcrun altool`/`notarytool` unless the user
   supplies an App Store Connect API key.
3. **Never `sleep`-poll a foreground build.** Run the archive with
   `run_in_background: true` and watch the log with `Monitor`.

---

## Step 0 — Pre-flight checks (do all of these first)

```bash
cd <PROJECT>

# a) Xcode closed?
pgrep -x Xcode >/dev/null && echo "BLOCKED: Xcode is open" || echo "OK: Xcode closed"

# b) Current version — build number MUST be higher than anything uploaded before
grep -E "MARKETING_VERSION|CURRENT_PROJECT_VERSION" ios/iiGrain.xcodeproj/project.pbxproj | sort -u

# c) No empty purpose strings (an empty one = App Store rejection + runtime crash)
plutil -p ios/iiGrain/Info.plist | grep -iE "UsageDescription|ITSAppUsesNonExempt"
plutil -p ios/iiGrain/Info.plist | grep -E 'UsageDescription.*=> ""' && echo "PROBLEM: empty purpose string"

# d) babel console-strip plugin present (its absence FAILS the archive)
[ -d node_modules/babel-plugin-transform-remove-console ] && echo "OK: plugin" || echo "MISSING: run npm i -D babel-plugin-transform-remove-console"

# e) Pods installed
[ -d ios/Pods ] && echo "OK: Pods" || echo "MISSING: cd ios && pod install"
```

**Act on the results:**

- **Build number**: Apple rejects a re-used build number. Bump
  `CURRENT_PROJECT_VERSION`; bump `MARKETING_VERSION` only for a new marketing
  release. Confirm the target version with the user if unclear.
  ```bash
  cd <PROJECT>/ios
  sed -i '' 's/CURRENT_PROJECT_VERSION = 3;/CURRENT_PROJECT_VERSION = 4;/g' iiGrain.xcodeproj/project.pbxproj
  ```
- **`ITSAppUsesNonExemptEncryption`** missing → add `<key>…</key><false/>` to
  `ios/iiGrain/Info.plist`, else App Store Connect asks the encryption question
  on every upload.
- **Empty `NSLocationWhenInUseUsageDescription`** → fill it. Empty is worse than
  missing: the permission dialog renders blank and the app can crash.
- **Missing babel plugin** → `npm install --save-dev babel-plugin-transform-remove-console`.
  It strips `console.*` from release bundles; without it the app ships bearer
  tokens and raw GPS coordinates into the device log.

---

## Step 1 — Close Xcode and clean

```bash
osascript -e 'tell application "Xcode" to quit'
sleep 3   # only acceptable use: waiting on the quit AppleScript
pgrep -x Xcode >/dev/null && echo "STILL OPEN — ask user to close it manually" || echo "closed"

rm -rf ~/Library/Developer/Xcode/DerivedData/iiGrain-*
```

If the quit fails with `User cancelled. (-128)`, Xcode has a modal dialog open.
**Stop and ask the user to close Xcode manually** — do not force-kill it.

---

## Step 2 — Build the archive (background + monitor)

Pick the archive path so Organizer picks it up automatically — it **must** live
under `~/Library/Developer/Xcode/Archives/<YYYY-MM-DD>/`.

```bash
cd <PROJECT>/ios && \
mkdir -p "$HOME/Library/Developer/Xcode/Archives/<TODAY>" && \
xcodebuild -workspace iiGrain.xcworkspace -scheme iiGrain \
  -configuration Release -destination 'generic/platform=iOS' \
  -archivePath "$HOME/Library/Developer/Xcode/Archives/<TODAY>/iiGrain <VERSION> build<N>.xcarchive" \
  -allowProvisioningUpdates ENABLE_USER_SCRIPT_SANDBOXING=NO archive \
  > /tmp/archive.log 2>&1; echo "EXIT: $?"
```

Run it with `run_in_background: true`, then arm a `Monitor` on the log —
match **both** success and failure signatures, or a crash looks like "still running":

```bash
tail -f /tmp/archive.log | grep -E --line-buffered \
  "ARCHIVE SUCCEEDED|ARCHIVE FAILED|BUILD FAILED|The following build commands failed|error: |PhaseScriptExecution failed|No signing certificate|not allowed to perform"
```

Takes **10–15 minutes**. Tell the user to leave Xcode closed meanwhile.

---

## Step 3 — Verify the archive

```bash
A="$HOME/Library/Developer/Xcode/Archives/<TODAY>/iiGrain <VERSION> build<N>.xcarchive"
[ -d "$A" ] && du -sh "$A"
P="$A/Products/Applications/iiGrain.app/Info.plist"
echo "version: $(plutil -extract CFBundleShortVersionString raw "$P")"
echo "build:   $(plutil -extract CFBundleVersion raw "$P")"
echo "bundle:  $(plutil -extract CFBundleIdentifier raw "$P")"
```

Expect ~166 MB and the version/build you set. The app inside is signed with an
**Apple Development** certificate — that is correct and expected; Xcode re-signs
with a Distribution certificate during Distribute App.

---

## Step 4 — Hand off to the user for upload

Report the archive is ready and give exactly this:

1. Open **Xcode**
2. `Cmd + Shift + 9` (**Window → Organizer**)
3. **Archives** tab → select `iiGrain <VERSION> build<N>` (today's date)
4. **Distribute App** → **App Store Connect** → **Upload**
5. Keep **Automatically manage signing** → **Upload**

Note for the user: this Mac has no Apple *Distribution* certificate in its
keychain — Xcode creates one during this flow. Approve the prompt if it appears.

After upload, processing takes 15–30 minutes before the build appears in
TestFlight.

---

## Known failure modes

| Symptom in log | Cause | Fix |
|---|---|---|
| `Command PhaseScriptExecution failed` + a Node/Babel stack trace | `babel-plugin-transform-remove-console` missing but referenced by `babel.config.js` `env.production` | `npm i -D babel-plugin-transform-remove-console`, re-run |
| Hundreds of unrelated compile errors in `Pods.build/Debug-iphonesimulator` | Xcode was opened during the run → DerivedData corruption | Close Xcode, `rm -rf ~/Library/Developer/Xcode/DerivedData/iiGrain-*`, re-run |
| `Sandbox: rsync deny`, "Operation not permitted" | User Script Sandboxing | Ensure `ENABLE_USER_SCRIPT_SANDBOXING=NO` is on the command (already in the recipe) |
| `No such module React`, missing modulemaps | Wrong CocoaPods version | `/opt/homebrew/bin/pod install` (1.16.2), not the bundler's 1.15.2 |
| `You are not allowed to perform this operation` (during upload) | Apple ID lacks Admin/Account Holder role | User must resolve with the team's account holder |
| Upload rejected: build number already used | `CURRENT_PROJECT_VERSION` not bumped | Bump it, rebuild |
| `Upload Symbols Failed` warnings for React/Hermes dSYMs | RN prebuilt frameworks ship without dSYMs | **Harmless — ignore.** Upload already succeeded |

Full clean rebuild if things are badly stuck:
```bash
osascript -e 'tell application "Xcode" to quit'
rm -rf ~/Library/Developer/Xcode/DerivedData/iiGrain-* <PROJECT>/ios/build
cd <PROJECT>/ios && /opt/homebrew/bin/pod install
```

---

## Optional: prove console-stripping actually works

Config alone is not evidence. Build a production bundle and grep it:

```bash
cd <PROJECT>
npx react-native bundle --platform ios --dev false --entry-file index.js \
  --bundle-output /tmp/prod.bundle --reset-cache
grep -c "getFarmDashboard\|assessorStream" /tmp/prod.bundle   # expect 0
```

---

## Reporting rules

- State the outcome plainly. If the archive failed, say so and paste the real
  error line — do not describe a failed build as done.
- The dSYM "Upload Symbols Failed" warnings are **not** failures.
- Do not claim the app was uploaded — you only build the archive; the user uploads.
