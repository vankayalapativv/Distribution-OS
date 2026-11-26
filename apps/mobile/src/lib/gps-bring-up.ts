/**
 * Detached from the Start-day return (see gps-start): capture one GPS fix
 * (time-boxed) so the route starts with a point, then start a tracking transport —
 * native foreground service → expo background updates → foreground watch. All
 * best-effort; the day is already committed, and the watchdog + next foreground
 * resume retry whatever didn't start.
 */
import * as Location from "expo-location";
import { PING_INTERVAL_MS, withTimeout } from "./gps-config";
import { startNativeForegroundTracking } from "./gps-native";
import { recordLocations, startBackgroundUpdates } from "./gps-recording";
import { getForegroundWatch, setForegroundWatch } from "./gps-state";

export async function bringUpTracking(clientSessionId: string): Promise<void> {
  try {
    const first = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }).catch(() => null),
      10_000,
      null,
    );
    if (first) recordLocations([first]);

    if (await startNativeForegroundTracking(clientSessionId)) return;

    const bg = await Location.requestBackgroundPermissionsAsync().catch(() => null);
    if (bg?.granted && (await startBackgroundUpdates())) return;

    getForegroundWatch()?.remove();
    setForegroundWatch(
      await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: PING_INTERVAL_MS, distanceInterval: 0 },
        (loc) => recordLocations([loc]),
      ),
    );
  } catch {
    // No transport could start (restricted OS / emulator). The day is already
    // committed, so isDayTracking() reflects it and check-in works; the native
    // service is retried by the watchdog and on the next foreground.
  }
}
