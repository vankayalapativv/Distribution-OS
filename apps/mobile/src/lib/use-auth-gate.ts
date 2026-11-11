import { useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { useAuth } from "./auth";
import { registerPushToken } from "./invoice-notifications";
import { flushPendingErrors, setErrorRoute } from "./report-error";
import { startSyncEngine, stopSyncEngine } from "./sync";
import { useNotificationRouter } from "./use-notification-router";
import { useSessionGuard } from "./use-session-guard";

/**
 * S1 — splash / auth gate logic: hydrate the token, route to login or the
 * role home, drive the offline sync engine, and gate the reveal so the wrong
 * role's UI never paints for a frame on cold start. Returns what the gate view
 * needs to render.
 */
export function useAuthGate() {
  const { token, user, hydrated, hydrate } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [started, setStarted] = useState(false);

  useEffect(() => {
    void hydrate().finally(() => setStarted(true));
  }, [hydrate]);

  // A tapped notification routes to the right screen.
  useNotificationRouter();

  // Log the user out promptly if an admin revokes their Neon session (foreground
  // + slow idle probe); offline-safe — only a definitive revocation acts.
  useSessionGuard();

  // Register this device for invoice pushes once a session exists.
  useEffect(() => {
    if (token) void registerPushToken();
  }, [token]);

  // Attribute error reports to the current screen, and flush any reports that
  // were buffered while offline (e.g. a crash on a previous, signal-less run)
  // now that a session exists to attribute them to.
  useEffect(() => {
    setErrorRoute("/" + segments.join("/"));
  }, [segments]);
  useEffect(() => {
    if (token) void flushPendingErrors();
  }, [token]);

  const group = segments[0];
  const onLogin = group === "login";
  // Three role home GROUPS. Being inside a DIFFERENT role's group forces a
  // redirect; shared pushed screens (settings, customer, ledger, order, …) are
  // open to whoever navigates there — they scope their own data.
  const ROLE_GROUPS = ["(tabs)", "(logistics)", "(admin)"];
  const isLogistics = user?.role === "LOGISTICS";
  const isAdmin = user?.role === "SUPER_ADMIN";
  let myGroup = "(tabs)";
  if (isLogistics) myGroup = "(logistics)";
  else if (isAdmin) myGroup = "(admin)";
  // Group-qualify EVERY home. "/(tabs)" targets the SE tabs unambiguously (a
  // bare "/" from inside (admin) resolves back to (admin)/index → splash hang).
  let myHome = "/(tabs)";
  if (isLogistics) myHome = "/(logistics)/delivery";
  else if (isAdmin) myHome = "/(admin)";
  const inWrongGroup = ROLE_GROUPS.includes(group) && group !== myGroup;

  // True while the app is on the wrong top-level route for the current auth
  // state — i.e. a redirect is pending. Keep the splash up until this clears.
  let needsRedirect = false;
  if (token) {
    if (onLogin || inWrongGroup) needsRedirect = true;
  } else if (!onLogin) {
    needsRedirect = true;
  }

  useEffect(() => {
    if (!hydrated || !started) return;
    if (!token && !onLogin) {
      router.replace("/login");
    } else if (token && (onLogin || inWrongGroup)) {
      router.replace(myHome as never);
    }
    // Super Admin is ONLINE-ONLY: never run the offline/sync engine. Tear it
    // down if it was already running (e.g. an SE session on a shared device
    // before the SA logged in). SE and Logistics keep the full offline engine.
    if (token) {
      if (isAdmin) stopSyncEngine();
      else startSyncEngine();
    }
  }, [token, isAdmin, onLogin, inWrongGroup, myHome, hydrated, started, router]);

  // Reveal only after the route settled AND the destination screen had a beat to
  // paint (react-navigation keeps the outgoing screen up for a frame or two).
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    if (needsRedirect) {
      setRevealed(false);
      return;
    }
    const t = setTimeout(() => setRevealed(true), 250);
    return () => clearTimeout(t);
  }, [needsRedirect]);

  return { hydrated, started, revealed };
}
