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

  // Do NOT mount the navigator (children) until the auth token has HYDRATED from
  // storage. On a warm resume — Android reclaims the JS process after a few idle
  // minutes — the store restarts with token=null and loads the saved session
  // asynchronously; if the screens mount first, their data hooks fire a request
  // with no token → 401 → a FALSE "Session expired" that a pull-to-refresh only
  // clears once the token lands. Gating the mount on `hydrated` guarantees every
  // screen's first fetch carries the real token (and the splash already covers
  // this brief window).
  //
  // The cost is a benign expo-router dev warning ("Can't perform a React state
  // update on a component that hasn't mounted yet", from fork/useLinking.native.js
  // resolving the initial URL before the navigator mounts): a no-op in production,
  // and silenced by the LogBox.ignoreLogs rule in _layout.tsx.
  //
  // The GlobalOfflineBar above already consumes the status-bar inset. A NESTED
  // SafeAreaProvider wrapping the navigator re-measures the safe area from its
  // own position (below the bar), so each screen's `SafeAreaView edges={["top"]}`
  // collapses its top inset to 0 while the bar is shown (no doubled gap) and
  // reports the full status-bar height when the bar is hidden — without any
  // per-screen change. (A JS SafeAreaInsetsContext override would NOT work: the
  // native SafeAreaView view ignores it.)
  const ready = hydrated && started && revealed;

  return (
    <View className="flex-1">
      <GlobalOfflineBar />
      <SafeAreaProvider style={{ flex: 1 }}>
        {hydrated ? children : null}
        {ready ? null : <Splash overlay />}
      </SafeAreaProvider>
    </View>
  );
}
