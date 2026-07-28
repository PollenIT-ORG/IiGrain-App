# iiGrain — Archive Kaise Banaye (App Store / TestFlight)

Ye guide **aapke liye** hai. Neeche wala tarika **verified hai** — isi se
v2.0 (build 2) aur v2.0 (build 3) successfully bane the.

> **Chhoti si baat pehle:** Xcode ka `Product → Archive` is project pe
> baar-baar fail hota hai. Neeche "Xcode se kyun fail hota hai" me wajah
> likhi hai. **Terminal wala tarika use karo — wo chalta hai.**

---

## ⚡ Short version (jaldi me ho to sirf ye)

```bash
# 1) Xcode BAND karo (bahut zaroori)
osascript -e 'tell application "Xcode" to quit'

# 2) Purana DerivedData saaf
rm -rf ~/Library/Developer/Xcode/DerivedData/iiGrain-*

# 3) Archive banao (10–15 min) — DATE aur VERSION apne hisaab se badlo
cd /Users/patel/Desktop/TCQProjects/FarmerApp/ios

xcodebuild -workspace iiGrain.xcworkspace -scheme iiGrain \
  -configuration Release -destination 'generic/platform=iOS' \
  -archivePath "$HOME/Library/Developer/Xcode/Archives/2026-07-22/iiGrain 2.0 build4.xcarchive" \
  -allowProvisioningUpdates ENABLE_USER_SCRIPT_SANDBOXING=NO archive
```

`** ARCHIVE SUCCEEDED **` dikhe → **Xcode kholo → `Cmd + Shift + 9` (Organizer)
→ archive select → Distribute App → App Store Connect → Upload.**

---

## 📋 Archive banane se PEHLE — checklist

### 1. Version bump karo (dono jagah)

File: `ios/iiGrain.xcodeproj/project.pbxproj`

| Field | Kya hai | Kab badalna |
|---|---|---|
| `MARKETING_VERSION` | User ko dikhne wala version (jaise `2.0`) | Bada release ho to (`3.0`) |
| `CURRENT_PROJECT_VERSION` | Build number (jaise `3`) | **Har upload pe badhana ZAROORI** |

**Rule:** Apple same build number dobara accept nahi karta. Agar 2.0(3) upload
ho chuka hai, to agla **2.0(4)** hona chahiye.

Terminal se badalne ka tarika:
```bash
cd /Users/patel/Desktop/TCQProjects/FarmerApp/ios
sed -i '' 's/CURRENT_PROJECT_VERSION = 3;/CURRENT_PROJECT_VERSION = 4;/g' iiGrain.xcodeproj/project.pbxproj
# check:
grep -E "MARKETING_VERSION|CURRENT_PROJECT_VERSION" iiGrain.xcodeproj/project.pbxproj | sort -u
```

### 2. Ye cheezein `ios/iiGrain/Info.plist` me honi chahiye

| Key | Kyun |
|---|---|
| `ITSAppUsesNonExemptEncryption` = `false` | Nahi hoga to upload pe **encryption ka sawaal** poochega har baar |
| `NSLocationWhenInUseUsageDescription` (khaali NAHI) | Khaali hui to **Apple reject** karega + app crash |
| `NSLocationAlwaysAndWhenInUseUsageDescription` | Warning aayegi |
| `NSCameraUsageDescription`, `NSMicrophoneUsageDescription`, `NSPhotoLibrary*` | Sab bhare hone chahiye |

Check karne ke liye:
```bash
plutil -p ios/iiGrain/Info.plist | grep -iE "UsageDescription|ITSAppUsesNonExempt"
# Koi bhi khaali ("") nahi hona chahiye
```

### 3. babel plugin installed hona chahiye

```bash
npm ls babel-plugin-transform-remove-console
# na mile to:
npm install --save-dev babel-plugin-transform-remove-console
```

> **Ye plugin miss hone se archive FAIL hota hai** (`PhaseScriptExecution failed`).
> Ye release build se `console.log` hatata hai — warna **auth token aur GPS
> coordinates** device log me chale jate hain (security issue).

### 4. Pods

```bash
cd ios && pod install && cd ..
```
CocoaPods **1.16.2** (`/opt/homebrew/bin/pod`) use karo. Purana 1.15.2 Xcode 26
ke liye toota hua Pods project banata hai.

---

## 🚀 Archive banao — poora step by step

```bash
# STEP 1 — Xcode band karo. Ye SABSE zaroori step hai.
osascript -e 'tell application "Xcode" to quit'
pgrep -x Xcode && echo "ABHI BHI KHULA HAI — manually Cmd+Q karo" || echo "band hai, aage badho"

# STEP 2 — DerivedData saaf (purani corrupt build hata do)
rm -rf ~/Library/Developer/Xcode/DerivedData/iiGrain-*

# STEP 3 — Archive (10–15 min lagega)
cd /Users/patel/Desktop/TCQProjects/FarmerApp/ios

xcodebuild -workspace iiGrain.xcworkspace -scheme iiGrain \
  -configuration Release -destination 'generic/platform=iOS' \
  -archivePath "$HOME/Library/Developer/Xcode/Archives/2026-07-22/iiGrain 2.0 build4.xcarchive" \
  -allowProvisioningUpdates ENABLE_USER_SCRIPT_SANDBOXING=NO archive
```

**Archive kahan save ho rahi hai, wo important hai:**
`~/Library/Developer/Xcode/Archives/<YYYY-MM-DD>/` me daalne se wo
**Organizer me apne aap dikh jati hai**. Kisi aur jagah save karoge to
Organizer me nahi dikhegi.

### Archive check karo (upload se pehle)

```bash
A="$HOME/Library/Developer/Xcode/Archives/2026-07-22/iiGrain 2.0 build4.xcarchive"
P="$A/Products/Applications/iiGrain.app/Info.plist"
plutil -extract CFBundleShortVersionString raw "$P"   # => 2.0
plutil -extract CFBundleVersion raw "$P"              # => 4
plutil -extract CFBundleIdentifier raw "$P"           # => com.amitbaser.iigrain
```

---

## 📤 Upload (ye Xcode se hi hoga)

1. **Xcode kholo**
2. `Cmd + Shift + 9` (menu: **Window → Organizer**)
3. **Archives** tab → apni archive select karo (date ke saath dikhegi)
4. Neela **Distribute App**
5. **App Store Connect** → Next
6. **Upload** → Next
7. **Automatically manage signing** rehne do → Next
8. **Upload**

> Pehli baar Xcode **Distribution certificate** khud banayega — "Allow"
> kar dena. Ye is Mac pe pehle se nahi hota, aur normal baat hai.

Upload ke **15–30 min** baad TestFlight me build "Processing" se ready ho jayegi.

---

## ❓ Xcode se Archive kyun fail hota hai

Jo problems is project pe actually aayi hain:

| Problem | Wajah | Ilaaj |
|---|---|---|
| `Product → Archive` **grey/disabled** | Upar **Simulator** select hai | Device dropdown → **"Any iOS Device (arm64)"** |
| Hazaaron **compile errors** achanak | Xcode aur terminal build **saath** chal rahe the — dono ek hi DerivedData me likhte hain → corrupt | Ek waqt pe **sirf ek** build. Terminal build ke waqt Xcode band. |
| `Sandbox: rsync deny` / "Operation not permitted" | User Script Sandboxing on | `ENABLE_USER_SCRIPT_SANDBOXING=NO` (project me set hai; command me bhi diya hua hai) |
| `No such module React` / modulemap missing | CocoaPods 1.15.2 (bundler wala) | `/opt/homebrew/bin/pod` (**1.16.2**) use karo |
| `Command PhaseScriptExecution failed` + Node error | `babel-plugin-transform-remove-console` missing tha, par `babel.config.js` use maang raha tha | `npm i -D babel-plugin-transform-remove-console` |
| Xcode quit nahi hota (`User cancelled -128`) | Xcode me koi dialog khula hai / busy hai | Xcode pe jao, dialog band karo, phir `Cmd+Q` |

### 🔴 Sabse badi galti (ye mat karna)

**Archive chalte waqt Xcode mat kholna.** Aisa ek baar hua tha aur poori
build corrupt ho gayi thi — 15 minute waste, phir DerivedData delete karke
dobara shuru karna pada.

---

## 🔑 Project ki details (reference)

| | |
|---|---|
| Workspace | `ios/iiGrain.xcworkspace` (`.xcodeproj` **nahi**) |
| Scheme | `iiGrain` — ⚠️ ek `iiGrain 1` bhi hai, **wo galti se mat chunna** |
| Bundle ID | `com.amitbaser.iigrain` |
| Team | `SADMK33W84` (Amit Baser) |
| Xcode | 26.2 · CocoaPods 1.16.2 · Node v25.6.1 |

**Signing ke baare me:** Is Mac pe sirf *Apple Development* certificates hain,
*Distribution* nahi. Ye theek hai — archive development cert se sign hoti hai,
aur **Distribute App** ke waqt Xcode distribution cert khud bana ke re-sign
karta hai. Ye koi error nahi hai.

---

## 🩹 Fail ho jaye to

```bash
# Poori tarah clean karke dobara
osascript -e 'tell application "Xcode" to quit'
rm -rf ~/Library/Developer/Xcode/DerivedData/iiGrain-*
rm -rf ios/build
cd ios && /opt/homebrew/bin/pod install && cd ..
# phir upar wala archive command dobara
```

Error ka asli reason dhoondhne ke liye (output bahut lamba hota hai —
log file me daal ke grep karo):

```bash
xcodebuild ... archive > /tmp/archive.log 2>&1
grep -E "error:|ARCHIVE (SUCCEEDED|FAILED)|PhaseScriptExecution" /tmp/archive.log | head -20
```
