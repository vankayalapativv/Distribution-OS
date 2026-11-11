import * as Device from "expo-device";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { openAutostartSettings } from "./permissions-native";
import type { ConfirmFn } from "./permissions";

/**
 * OEMs whose battery managers kill a foreground service even with battery
 * optimization disabled — the fleet data shows vivo/OnePlus dropping pings. For
 * these we nudge the SE, once per install, to whitelist Distribution OS in the vendor's
 * "auto-start / background start" screen. Non-blocking: the state can't be read
 * back, so we prompt once and move on (persisted in SecureStore).
 */
const AGGRESSIVE_OEMS = [
  "xiaomi", "redmi", "poco", "vivo", "iqoo", "oppo", "realme", "oneplus", "huawei", "honor",
];
const AUTOSTART_PROMPTED_KEY = "distribution_os_autostart_prompted";

export async function maybePromptAutostart(confirm: ConfirmFn): Promise<void> {
  if (Platform.OS !== "android") return;
  const brand = `${Device.manufacturer ?? ""} ${Device.brand ?? ""}`.toLowerCase();
  if (!AGGRESSIVE_OEMS.some((m) => brand.includes(m))) return;
  const alreadyPrompted = await SecureStore.getItemAsync(AUTOSTART_PROMPTED_KEY).catch(() => null);
  if (alreadyPrompted) return;
  const proceed = await confirm({
    title: "Keep Distribution OS running in the background",
    message:
      'Your phone can stop Distribution OS from recording when the screen is off. On the next screen, turn ON "Auto-start" (or "Allow background activity") for Distribution OS. You only need to do this once.',
    confirmLabel: "Open settings",
    cancelLabel: "Skip",
  });
  // Mark prompted regardless so we don't nag daily (state isn't readable).
  await SecureStore.setItemAsync(AUTOSTART_PROMPTED_KEY, "1").catch(() => undefined);
  if (proceed) await openAutostartSettings();
}
