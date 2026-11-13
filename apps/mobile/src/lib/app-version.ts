import Constants from "expo-constants";
export { readUpdateReleaseInfo, type UpdateReleaseInfo } from "./update-release-info";

/** Base native app version from app.json (tied to runtimeVersion via the
 *  appVersion policy). Only changes with a new APK. */
export const APP_VERSION = Constants.expoConfig?.version ?? "0.0.1";

/**
 * OTA build label of the CURRENTLY running bundle — shown in the in-app Settings
 * footer so the field team (and support) can see exactly which over-the-air build
 * a phone is on. The 4th segment is the OTA counter (e.g. 0.0.1.3).
 *
 * Single source of truth: app.json `expo.extra.otaBuild`. Bump it on EVERY
 * `eas update` push (0.0.1.1 → 0.0.1.2 → …). When a new native APK ships, set the
 * first three segments to the new app.json `version` and reset the counter to .1.
 *
 * Reading the label from `expo.extra` is OTA-safe here because the runtimeVersion
 * policy is "appVersion" (derived ONLY from `version`), so changing `extra` never
 * shifts the native runtime or orphans installed apps. The update-download screen
 * reads the INCOMING build's label the same way, from its manifest (see
 * update-release-info). (The old Sri-Aparajita project used the "fingerprint"
 * policy, which hashed `extra`, so it had to keep this as a plain JS constant —
 * that constraint no longer applies.)
 */
export const OTA_BUILD =
  (Constants.expoConfig?.extra as { otaBuild?: string } | undefined)?.otaBuild ?? APP_VERSION;
