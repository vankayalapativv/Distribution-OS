const { withGradleProperties } = require("expo/config-plugins");

/**
 * Restrict the Android native ABIs baked into the APK.
 *
 * By default Expo prebuild sets `reactNativeArchitectures` to all four ABIs
 * (armeabi-v7a, arm64-v8a, x86, x86_64), so every native `.so` (React Native,
 * Hermes, and each native module) ships four times. A phone only ever loads
 * one of them, so the other copies are dead weight — the bulk of the ~120 MB
 * EAS preview APK.
 *
 * We ship `arm64-v8a` (every 64-bit phone since ~2017, incl. the test Moto)
 * plus `armeabi-v7a` (old / ultra-budget 32-bit phones, e.g. Android Go) so
 * no field device is left out, while still dropping the two x86 emulator ABIs.
 * That keeps the APK ~50% smaller than the default all-4-ABI build.
 *
 * OS-version reach is separate (minSdkVersion, currently 24 = Android 7.0) and
 * already covers the last 5 Android versions and older.
 *
 * Override with e.g. `ANDROID_ABIS=arm64-v8a` for the smallest possible APK.
 */
const ABIS = process.env.ANDROID_ABIS || "arm64-v8a,armeabi-v7a";

module.exports = function withAndroidAbiFilter(config) {
  return withGradleProperties(config, (cfg) => {
    const props = cfg.modResults;
    const existing = props.find(
      (p) => p.type === "property" && p.key === "reactNativeArchitectures",
    );
    if (existing) {
      existing.value = ABIS;
    } else {
      props.push({ type: "property", key: "reactNativeArchitectures", value: ABIS });
    }
    return cfg;
  });
};
