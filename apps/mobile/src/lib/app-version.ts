import Constants from "expo-constants";
export { readUpdateReleaseInfo, type UpdateReleaseInfo } from "./update-release-info";

/** Base native app version from app.json (tied to runtimeVersion via the
 *  appVersion policy). Only changes with a new APK. */
export const APP_VERSION = Constants.expoConfig?.version ?? "1.0.0";

/**
 * OTA build label of the CURRENTLY running bundle — shown in the in-app Settings
 * footer so the field team (and support) can see exactly which over-the-air build
 * a phone is on.
 *
 * Bump this string on EVERY `eas update` push (1.1.2.1 → 1.1.2.2 → …). When a new
 * native APK ships, set the first three segments to the new app.json `version`
 * and reset the counter to .1.
 *
 * IMPORTANT: this is a plain JS constant, NOT app.json `expo.extra`, on purpose.
 * The runtimeVersion policy is "fingerprint", which hashes the Expo config `extra`
 * section — so putting the label in `extra` would change the runtimeVersion and
 * orphan every already-installed app from the OTA channel (verified: adding it
 * moved the fingerprint off the shipped runtime). A JS constant ships inside the
 * bundle and never touches the native runtime, so it travels with the OTA freely.
 */
export const OTA_BUILD = "1.1.2.2";
