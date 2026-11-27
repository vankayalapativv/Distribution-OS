import { View } from "react-native";
import { useOtaUpdate } from "./update-gate-hook";
import { UpdateOverlay } from "./update-gate-overlay";
import { styles } from "./update-gate-styles";

/**
 * Visible OTA updater. expo-updates checks + downloads a new JS bundle on launch
 * (default ON_LOAD). Instead of that happening silently — leaving the user to
 * quit and reopen twice before the new version applies — this shows a real
 * download progress bar, the incoming version + "What's new" (read from that
 * update's manifest), then an "Installing…" phase, and reloads into the new
 * bundle in the SAME session.
 *
 * Children stay mounted behind an absolute overlay (no unmount → no refetch
 * flash). It never blocks when there's no update, offline, in dev, or on error.
 */
export function UpdateGate({ children }: { readonly children: React.ReactNode }) {
  const { installing, downloading, version, notes, pct } = useOtaUpdate();
  const show = installing || downloading;

  return (
    <View style={styles.root}>
      {children}
      {show ? <UpdateOverlay installing={installing} version={version} notes={notes} pct={pct} /> : null}
    </View>
  );
}
