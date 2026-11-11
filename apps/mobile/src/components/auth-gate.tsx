import type { ReactNode } from "react";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useAuthGate } from "../lib/use-auth-gate";
import { GlobalOfflineBar } from "./global-offline-bar";
import { Splash } from "./splash";

/** S1 — splash / auth gate: hydrate the token, route to login or the role home,
 *  and cover the navigator with the splash until the correct screen is on screen. */
export function AuthGate({ children }: { readonly children: ReactNode }) {
  const { hydrated, started, revealed } = useAuthGate();

  // Before hydration there is no navigator to route yet — plain splash.
  if (!hydrated || !started) {
    return <Splash />;
  }

  // Keep the navigator mounted (so router.replace works), but cover it with the
  // splash until the correct screen for this role is actually on screen.
  // The GlobalOfflineBar above already consumes the status-bar inset. A NESTED
  // SafeAreaProvider wrapping the navigator re-measures the safe area from its
  // own position (below the bar), so each screen's `SafeAreaView edges={["top"]}`
  // collapses its top inset to 0 while the bar is shown (no doubled gap) and
  // reports the full status-bar height when the bar is hidden — without any
  // per-screen change. (A JS SafeAreaInsetsContext override would NOT work: the
  // native SafeAreaView view ignores it.)
  return (
    <View className="flex-1">
      <GlobalOfflineBar />
      <SafeAreaProvider style={{ flex: 1 }}>
        {children}
        {revealed ? null : <Splash overlay />}
      </SafeAreaProvider>
    </View>
  );
}
