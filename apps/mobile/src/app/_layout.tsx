import "../global.css";

import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, type ErrorBoundaryProps } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { AuthGate } from "../components/auth-gate";
import { DialogProvider } from "../components/dialog";
import { ToastProvider } from "../components/toast";
import { ErrorScreen } from "../components/error-screen";
import { LocationGuard } from "../components/location-guard";
import { UpdateGate } from "../components/update-gate";
import { installGlobalErrorLogging } from "../lib/global-error-logging";
import {
  detectPreviousNativeCrash,
  installSessionActivityTracking,
} from "../lib/native-crash-detect";
import { installGpsWatchdog } from "../lib/gps";
import { PhotoStampHost } from "../lib/photo-stamp";
import { installNotificationHandler } from "../lib/reminders";
import { reportMobileError } from "../lib/report-error";
import { installUnhandledRejectionReporting } from "../lib/unhandled-rejection";
import { queryClient } from "../lib/query-client";

/**
 * Top-level error boundary (Expo Router picks up this named export from the
 * root layout). Catches render errors anywhere in the app and shows a
 * recoverable screen instead of a hard crash / white screen.
 */
export function ErrorBoundary({ error, retry }: Readonly<ErrorBoundaryProps>) {
  console.error("[SriAparajitaCrash] render error:", error?.message, error?.stack);
  reportMobileError(error, { boundary: "root-render", fatal: true });
  return <ErrorScreen error={error} retry={retry} />;
}

installGlobalErrorLogging();
// ErrorUtils only catches synchronous/uncaught errors — also route unhandled
// promise rejections (a rejected await with no try/catch) into the monitor.
installUnhandledRejectionReporting();
// A leftover "foreground active" flag on launch = the previous session died in
// the foreground with no JS error — a probable native crash / OOM. Report it,
// then track foreground/background so the flag is only set while in front.
void detectPreviousNativeCrash();
installSessionActivityTracking();
// Restarts day tracking on app-open if Android killed the background task.
installGpsWatchdog();
// Reminders show their banner even while the app is open.
installNotificationHandler();

export default function RootLayout() {
  return (
    <KeyboardProvider>
      <UpdateGate>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
          <DialogProvider>
            <AuthGate>
              <LocationGuard>
                {/* animation "none": the role redirect swaps groups instantly, so
                    the outgoing SE screen never slides into view on cold start. */}
                <Stack screenOptions={{ headerShown: false, animation: "none" }} />
              </LocationGuard>
            </AuthGate>
            {/* Off-screen composer that burns the address/date band into photos. */}
            <PhotoStampHost />
          </DialogProvider>
          </ToastProvider>
          <StatusBar style="auto" />
        </QueryClientProvider>
      </UpdateGate>
    </KeyboardProvider>
  );
}
