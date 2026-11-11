# Sri Aparajita Mobile App — Build & Release Guide

The complete, from-scratch guide for the **Sri Aparajita Distribution** field app
(`apps/mobile`): setting up a machine, running the app in development,
debugging, changing the icon/name/splash, building an installable APK, and
deploying the API it talks to.

The app is built with **React Native + Expo (SDK 57)** and **expo-router**,
inside a **pnpm monorepo**. It is used by **Sales Executives only** — login,
customer capture with photos & GPS, orders with a credit gate, collections,
market-intelligence photos, offline sync, and background day-tracking.

---

## 1. One-time machine setup

Install these once:

| Tool | Version | How |
|------|---------|-----|
| Node.js | 20 LTS or newer | https://nodejs.org |
| pnpm | 10.x | `npm install -g pnpm` |
| Android Studio | latest | https://developer.android.com/studio — install the SDK + an emulator (e.g. Pixel 8, API 35) |
| watchman (macOS) | latest | `brew install watchman` |
| EAS CLI login | — | no global install needed; `npx eas-cli` is used ad-hoc |

Add the Android tools to your shell profile (`~/.zshrc`):

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator"
```

### Clone and install

```bash
git clone <repo-url> Beyond-Distribution-Management-System
cd Beyond-Distribution-Management-System
pnpm install         # installs ALL workspaces (api, web, mobile, packages)
```

> ⚠️ **NEVER run `npm install` anywhere in this repo.** The monorepo is
> pnpm-only; mixing npm broke the previous mobile app beyond repair
> (see AGENTS.md history). Always `pnpm`.

### Accounts you need

- **Expo account** (for APK builds): the project belongs to the
  `vardhansystems` account — ask for access, then `npx eas-cli login`
  from `apps/mobile`. Verify with `npx eas-cli whoami`.
- **Test login** (Sales Executive): `test@test.com` / ask the team.
  SEs only see customers they created themselves — an empty customer
  list on a fresh account is correct behaviour, not a bug.

---

## 2. Running the app in development

Two processes are involved: the **API** (Cloudflare Workers dev server)
and **Metro** (the React Native bundler). For the emulator you usually
run both locally.

```bash
# Terminal 1 — the API on port 8787
cd apps/api && pnpm dev

# Terminal 2 — Metro + the app
cd apps/mobile && npx expo start --android
```

`--android` opens the app in **Expo Go** on the running emulator
automatically. Start the emulator first from Android Studio
(Device Manager ▸ ▶) or `emulator -avd Pixel_8`.

### Pointing the app at an API

The base URL comes from `EXPO_PUBLIC_API_URL` (see `src/lib/api.ts`):

| Situation | Value |
|-----------|-------|
| Emulator + local API | *(nothing — default `http://localhost:8787/api/v1` works via `adb reverse`)* |
| Physical phone + local API | `http://<your-Mac-LAN-IP>:8787/api/v1` (same Wi-Fi) |
| Anywhere + production API | `https://api.vardhansystems.workers.dev/api/v1` |

Set it in `apps/mobile/.env` (`EXPO_PUBLIC_API_URL=…`) or inline:
`EXPO_PUBLIC_API_URL=… npx expo start --android`.
For the emulator + localhost, run `adb reverse tcp:8787 tcp:8787` once
after the emulator boots.

### What works in Expo Go vs a real build

Expo Go is fastest for UI work, but two features are degraded:

- **Background GPS (Start day)**: foreground-only in Expo Go. The real
  5-minute background pings with the persistent notification need a
  built APK.
- Native config changes (permissions, icon, splash) only take effect in
  a build, not in Expo Go.

---

## 3. Debugging

- **JS logs**: they stream into the Metro terminal. `console.log` away.
- **Element inspector / performance monitor**: shake the device, or
  `adb shell input keyevent 82` on the emulator → dev menu.
- **Reload**: press `r` in the Metro terminal. Fast Refresh applies most
  edits automatically.
- **Network debugging**: the API dev server prints every request
  (`wrangler:info GET /api/v1/... 200`) in the API terminal — check
  there first when a screen shows an error state.
- **Offline sync inspection**: the app keeps a local SQLite DB
  (expo-sqlite). Sync state chips ("Synced ✓ / Pending") on Home reflect
  the queue; killing the API and using the app exercises offline mode.
- **Common gotchas**
  - *Metro crashes instantly with "expo is not installed"*: you started
    it from the repo root. Always `cd apps/mobile` first.
  - *Stale port 8787*: `pkill -f workerd; pkill -f wrangler` then
    restart `pnpm dev`.
  - *Emulator soft keyboard doesn't appear*:
    `adb shell settings put secure show_ime_with_hard_keyboard 1`.
  - *Photo re-appears after force-killing mid-camera*: known Android
    activity-redelivery quirk; harmless in normal use.

---

## 4. Changing the app identity (icon, name, splash, version)

Everything lives in **`apps/mobile/app.json`**. After changing any of
these, rebuild the APK (section 5) — Expo Go won't show them.

### App name (under the icon on the phone)

```jsonc
"expo": {
  "name": "Sri Aparajita",        // ← display name
  "slug": "mobile",        // ← EAS project slug — do NOT change
  ...
}
```

### Icon

Android uses an **adaptive icon** (layered):

```jsonc
"android": {
  "adaptiveIcon": {
    "foregroundImage": "./assets/images/android-icon-foreground.png",
    "backgroundImage": "./assets/images/android-icon-background.png",
    "monochromeImage": "./assets/images/android-icon-monochrome.png",
    "backgroundColor": "#E6F4FE"
  }
}
```

Replace those PNGs in `assets/images/` (keep the same filenames and
square dimensions — 1024×1024 recommended; the foreground artwork should
sit inside the middle ~66% "safe zone" because Android crops the edges
into circles/squircles). `icon.png` in the same folder is the generic
fallback used elsewhere.

### Splash screen

Configured via the `expo-splash-screen` plugin in the same file:

```jsonc
["expo-splash-screen", {
  "backgroundColor": "#208AEF",   // splash background
  "image": "./assets/images/splash-icon.png",
  "imageWidth": 76
}]
```

### Version & package id

- `"version": "1.0.0"` — the human-visible version; bump for each release.
- Android `versionCode` is **auto-incremented by EAS** (`appVersionSource:
  "remote"` in `eas.json`) — you never touch it.
- `"package": "com.vardhansystems.sriaparajita"` — the Android application id
  (set 2026-08-01 for the Indus App Store release; was the Expo default
  `com.anonymous.mobile`).
  ⚠️ Changing it makes phones treat the next APK as a *different app*
  (fresh install, old one stays). It is now the store identity — do not
  change it again. **It is also bound to Firebase**: `google-services.json`
  must be issued for this exact package (add the Android app in the Firebase
  console and re-download it), or FCM push silently stops working.

### Permission prompt texts

The wording users see when the app asks for camera/location lives in the
`expo-image-picker` and `expo-location` plugin blocks of `app.json`.

> Note: this project has a committed `android/` folder (prebuild output).
> If a native config change doesn't seem to apply in a build, regenerate
> it with `npx expo prebuild -p android --clean` and commit the result.

### Background-location permissions (crash-critical)

Background day-tracking schedules a **persisted** JobScheduler job. Android
**crashes the whole app** (`FATAL EXCEPTION … IllegalArgumentException:
Requested job cannot be persisted without holding
android.permission.RECEIVE_BOOT_COMPLETED`) if these permissions are
missing. They must stay present in `app.json` **and** the committed
manifest:

- `RECEIVE_BOOT_COMPLETED` (required to schedule the persisted location job)
- `WAKE_LOCK`
- `ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE`,
  `FOREGROUND_SERVICE_LOCATION`

This exact crash appeared on a Motorola Edge 50 Neo on 2026-07-13 (found
via `adb logcat -b crash`) and was fixed by adding the first two.

---

## 5. Building a new APK (with all current features)

The build runs in **Expo's cloud (EAS)** — no local Android toolchain
needed for release builds.

### Step 0 — make sure the backend is current

The APK talks to the **deployed** API. If any API/database changes
shipped since the last deploy, deploy first:

```bash
cd apps/api
npx wrangler deploy         # → https://api.vardhansystems.workers.dev
```

(Neon migrations in `packages/db/migrations/` must also have been
applied — in this project they are applied as they are written.)

### Step 1 — pre-flight checks

```bash
cd apps/mobile
npx tsc --noEmit            # typecheck
npx vitest run              # unit tests
npx eas-cli whoami          # logged in? (should print vardhansystems)
```

### Step 2 — build

```bash
cd apps/mobile
EXPO_PUBLIC_API_URL=https://api.vardhansystems.workers.dev/api/v1 \
  npx eas-cli build --profile preview --platform android
```

- `--profile preview` (from `eas.json`) produces an **installable APK**
  for internal distribution. (`development` = dev client with Metro;
  `production` = store-ready AAB.)
- The env var is **baked into the JS bundle at build time** — this is
  what points the APK at the production API.
- The build takes ~15–25 minutes. The terminal prints a build page URL
  (`https://expo.dev/accounts/vardhansystems/projects/mobile/builds/…`)
  you can watch; it ends with an **APK download link + QR code**.

### Step 3 — install on a phone

1. Open the build page / QR on the phone and download the `.apk`.
2. Tap it → Android warns about unknown sources → allow the browser →
   Install.
3. First launch: log in as an SE, tap **Start day**, and choose
   **"Allow all the time"** for location — that's what enables the
   background 5-minute GPS pings (verify on the web **Live Tracking**
   page). Camera prompts appear on first photo capture.

### Troubleshooting builds

- **`Cannot find module 'babel-preset-expo'` / Gradle "Run gradlew" fails
  in `createBundleReleaseJsAndAssets`**: a dependency used by the build
  isn't a *direct* dependency of `apps/mobile`. pnpm's strict isolation
  means EAS can't see transitive packages — `pnpm add -D <package>` in
  `apps/mobile` and rebuild. (This exact babel-preset-expo case was hit
  and fixed on 2026-07-11.)
- **Build errored, need logs**:
  `npx eas-cli build:view <build-id>` prints status; the build page has
  full per-phase logs — read the "Run gradlew" phase bottom-up.
- **Stuck in queue**: free-tier builds queue behind others; just wait or
  check https://status.expo.dev.

---

## 6. Feature checklist for smoke-testing a new APK

After installing, run through:

1. **Login** as SE → Home shows Start day + sync chip.
2. **Start day** → persistent notification appears; web Live Tracking
   shows the SE "Live" within ~5 min (map trail grows every 5 min).
3. **Customers** → search finds only your own customers; **+ Add** with
   all mandatory fields (`*`), fixed +91 phone (10 digits), GST/PAN/Udyam
   formatting, GPS capture auto-filling City/State/Pincode, landmark box,
   camera + gallery photos. Duplicate phone must be rejected with the
   owner's name.
4. **Customer workspace** → Add Sale (blocked if >60-day dues), Add
   Collection, last-5 lists, Market Intelligence camera/gallery with
   delete.
5. **Edit customer** → fields pre-filled, shop-location on top,
   re-capture refreshes City/State/Pincode, customer photos add/delete.
6. **Keyboard** → while typing in any form you can scroll the whole
   form; tapping the next field focuses in one tap.
7. **Offline** → airplane mode, create an order → syncs when back online.
8. **Tab bar** → Home/Customers/Settings tabs shrink with a spring while
   pressed.
9. **Logout** (Settings) → returns to login.

---

## 7. Quick reference

| Task | Command (from repo root) |
|------|--------------------------|
| Install everything | `pnpm install` |
| Run API locally | `cd apps/api && pnpm dev` |
| Run app on emulator | `cd apps/mobile && npx expo start --android` |
| Typecheck / tests | `cd apps/mobile && npx tsc --noEmit && npx vitest run` |
| Deploy API | `cd apps/api && npx wrangler deploy` |
| Build APK | `cd apps/mobile && EXPO_PUBLIC_API_URL=https://api.vardhansystems.workers.dev/api/v1 npx eas-cli build --profile preview --platform android` |
| Check build status | `cd apps/mobile && npx eas-cli build:list --limit 3` |
| Forward local API to emulator | `adb reverse tcp:8787 tcp:8787` |
