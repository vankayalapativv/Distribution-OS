---
name: android-emulator-and-ota-testing
description: How to run the mobile app on the local Android emulator and verify OTA updates (JDK, expo run:android, installing the EAS APK, logcat signals)
metadata:
  type: reference
---

Verified workflow for running/verifying the `apps/mobile` app on the local Android emulator (macOS), worked out 2026-10-09.

**Toolchain / env (export these for adb+gradle):**
- `ANDROID_HOME=$HOME/Library/Android/sdk`; add `$ANDROID_HOME/platform-tools` + `$ANDROID_HOME/emulator` to PATH.
- AVD available: **`Pixel_8`** (`emulator -list-avds`). Boot: `emulator @Pixel_8` (run detached/background); wait for `adb shell getprop sys.boot_completed` == 1.
- JDK for Gradle: **Zulu 17** (installed via `brew install --cask zulu@17`). `export JAVA_HOME="$(/usr/libexec/java_home -v 17)"`. Without a JDK, `expo run:android` fails but adb installs still work.

**Run the LATEST working-tree code (JS incl. uncommitted):** `pnpm -C apps/mobile exec expo run:android` → builds a **debug** APK, installs, starts Metro, loads current JS. Gotchas: don't pass `--device <adb-serial>` (expo wants an AVD name or nothing — one running emulator is auto-picked); first native build ~several min; a debug APK (versionCode 1) **won't install over** an installed release (`INSTALL_FAILED_VERSION_DOWNGRADE`) — `adb uninstall com.vardhansystems.sriaparajita` first. **Debug builds DO NOT do OTA** (expo-updates disabled in dev — they load from Metro), so they can't verify an OTA.

**Verify an OTA (must use a RELEASE build):**
1. Get the field APK: `eas build:list --platform android --limit 6 --json` → take the latest FINISHED `indus` build's `artifacts.applicationArchiveUrl`, `curl -L` it (~90MB).
2. `adb uninstall com.vardhansystems.sriaparajita` (clears session → will need re-login) then `adb install -r <apk>`.
3. Launch (`adb shell am start -n com.vardhansystems.sriaparajita/.MainActivity`). The release build checks the `production` channel, and if an update matches its runtime it downloads + the in-app UpdateGate reloads.
4. Watch logs: `adb logcat -d | grep dev.expo.updates` — success sequence is `Updates state change: CheckCompleteAvailable` (isUpdateAvailable=true, manifest id = your update) → `Download` → `DownloadComplete` → `Restart`.
5. Inspect the screen with `adb exec-out screencap -p > shot.png` and (more reliable for text/structure) `adb shell uiautomator dump /sdcard/ui.xml; adb pull …` then grep the `text="…"` values.

**Predict OTA reach without publishing:** compute the android fingerprint and compare to the installed build's runtime —
`node -e "require('@expo/fingerprint').createFingerprintAsync(process.cwd(),{platforms:['android']}).then(f=>console.log(f.hash))"` (module resolves under the pnpm store; run from `apps/mobile`). Must equal the APK's Runtime Version for the OTA to land. See [[expo-ota-updates]] (the `app.json` `version` is PART of this hash — bumping it breaks OTA reach).

**The app calls the DEPLOYED API in release/OTA builds**, but `apps/mobile/.env` (`EXPO_PUBLIC_API_URL=http://10.0.2.2:8787`, the emulator alias for host localhost:8787) only applies to local `expo run:android`/Metro builds. So a feature that depends on a new API field works in the debug build (local API) yet looks broken on the OTA build until the Worker API is deployed. See [[savsol-dual-brand-and-segments]].
