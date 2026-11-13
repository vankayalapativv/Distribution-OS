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

  // Keep the navigator (children) mounted at ALL times — including before
  // hydration — and cover it with the splash overlay until the correct screen is
  // on screen. Returning a bare <Splash/> before hydration would leave the
  // navigator unmounted while expo-router resolves the initial URL; when that
  // promise resolves it calls setState on the not-yet-mounted navigator, which is
  // the LogBox warning "Can't perform a React state update on a component that
  // hasn't mounted yet" (expo-router fork/useLinking.native.js). Mounting the
  // navigator from the first render gives that state update a live target.
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
        {children}
        {ready ? null : <Splash overlay />}
      </SafeAreaProvider>
    </View>
  );
}
