import { Platform, StatusBar, Text, View } from "react-native";
import { useIsOnline } from "../lib/connectivity";
import { Icon } from "./icon";

// The bar sits above the navigator (the topmost element), so it must clear the
// status bar itself. Provider-free (no SafeAreaProvider dependency): use the
// Android status-bar height, and a safe constant for iOS notches.
const TOP_INSET = Platform.OS === "android" ? (StatusBar.currentHeight ?? 24) : 44;

/**
 * App-wide offline strip driven by the single connectivity signal. A flow
 * element (not an overlay) so it can never cover content: when offline it takes
 * a slim band at the very top and the app shifts down; when online it renders
 * nothing. Deliberately calm — the app keeps working, this just sets context.
 */
export function GlobalOfflineBar() {
  const online = useIsOnline();
  if (online) return null;
  return (
    <View
      style={{ paddingTop: TOP_INSET }}
      className="flex-row items-center justify-center gap-1.5 bg-slate-800 px-3 pb-1.5"
    >
      <Icon name="cloud-offline-outline" size={13} color="#e2e8f0" />
      <Text className="text-xs font-medium text-slate-100">No internet connection</Text>
    </View>
  );
}
