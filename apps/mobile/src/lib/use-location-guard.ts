// Mid-day location-health guard hook. While a field user's day/run is tracking
// (isDayTracking → role-aware: SE until 8 PM, Logistics for an active run), it
// re-verifies location health on every app→foreground return plus a slow idle
// tick. A bad reading triggers a rapid confirmation burst; only a debounced,
// confirmed problem flips `blocked` — a transient bad read must never lock the screen.

import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useAuth } from "./auth";
import { isDayTracking } from "./gps";
import { evaluateLocationHealth, type LocationBlockReason } from "./location-health";
import { GuardState, initialGuardState, reduceGuard } from "./location-guard-state";
import { getTrackingHeartbeatDeviceState } from "./sync";

const FIELD_ROLES = ["SALES_EXECUTIVE", "LOGISTICS"];
// Idle re-check cadence. Kept short so an in-app GPS/permission toggle (which
// fires no AppState "active" event) is still caught quickly, not after a minute.
const IDLE_INTERVAL_MS = 12_000;
// Confirmation-burst spacing once a bad reading appears — fast so the blocker
// locks within ~1s of foregrounding with location off, while still re-confirming
// (REQUIRED_CONSECUTIVE_BAD) to reject a one-off fluke read.
const BURST_INTERVAL_MS = 500;

async function readReason(): Promise<LocationBlockReason | null> {
  const d = await getTrackingHeartbeatDeviceState();
  return evaluateLocationHealth({
    isLocationEnabled: d.isLocationEnabled,
    foregroundPermission: d.foregroundPermission,
    backgroundPermission: d.backgroundPermission,
  });
}

export function useLocationGuard(): {
  blocked: boolean;
  reason: LocationBlockReason | null;
  recheck: () => void;
} {
  const role = useAuth((s) => s.user?.role);
  const isField = role != null && FIELD_ROLES.includes(role);
  const [state, setState] = useState<GuardState>(initialGuardState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const recheckRef = useRef<() => void>(() => {});

  useEffect(() => {
    // Non-field roles (Super Admin) have nothing to guard — don't run the idle
    // re-check loop or the AppState listener at all. Keeps the SA app free of
    // background timers.
    if (!isField) {
      stateRef.current = initialGuardState;
      setState(initialGuardState);
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let running = false;

    async function runCheck() {
      if (cancelled || running) return;
      running = true;
      let confirming = false;
      try {
        let reason: LocationBlockReason | null = null;
        const active = isField && (await isDayTracking());
        if (active) reason = await readReason();
        if (cancelled) return;
        const next = active ? reduceGuard(stateRef.current, reason) : initialGuardState;
        stateRef.current = next;
        setState(next);
        confirming = active && reason !== null && !next.blocked;
      } catch {
        // A device-state read failed (transient). Don't flip state on it — and,
        // crucially, don't let the throw skip the reschedule below, which would
        // kill the idle loop and leave a mid-day permission change unguarded
        // until the next foreground.
      } finally {
        running = false;
        // ALWAYS reschedule (unless torn down) so the loop is self-healing.
        if (!cancelled) {
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => void runCheck(), confirming ? BURST_INTERVAL_MS : IDLE_INTERVAL_MS);
        }
      }
    }

    recheckRef.current = () => void runCheck();
    void runCheck();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void runCheck();
    });
    return () => {
      cancelled = true;
      sub.remove();
      if (timer) clearTimeout(timer);
    };
  }, [isField]);

  return { blocked: isField && state.blocked, reason: state.reason, recheck: () => recheckRef.current() };
}
