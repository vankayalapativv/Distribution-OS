/**
 * SE Home day-tracking state. Owns the GPS day flags and the Start-day / End-day
 * flows. Re-checks the flags on mount, on app foreground, on screen focus, and
 * once a minute while the day is on (so the UI stays honest if the IST date rolls
 * over, or the day is ended on another device, while the screen stays open).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { router, useFocusEffect } from "expo-router";
import type { ConfirmOptions, PromptOptions } from "../components/dialog";
import { dayEndedToday, isDayTracking, markDayEndedToday, stopDayTracking } from "./gps";
import { getDayStartOdometer, getServerStartOdometer } from "./gps-session";
import { MAX_DAY_DISTANCE_KM, MIN_DAY_DISTANCE_KM, promptOdometer } from "./odometer-prompt";
import { runStartDayFlow } from "./start-day-flow";

type Confirm = (opts: ConfirmOptions) => Promise<boolean>;
type Prompt = (opts: PromptOptions) => Promise<string | null>;

export function useDayTracking(dialog: { confirm: Confirm; prompt: Prompt }) {
  const { confirm, prompt } = dialog;
  const [dayOn, setDayOn] = useState(false);
  const [dayEnded, setDayEnded] = useState(false);
  const [dayBusy, setDayBusy] = useState(false);

  // Guard the async setState — recheck fires from the AppState listener, focus,
  // and a 60s interval, any of which can resolve after the screen unmounts.
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const recheck = useCallback(() => {
    void Promise.all([isDayTracking(), dayEndedToday()]).then(([on, ended]) => {
      if (!mounted.current) return;
      setDayOn(on);
      setDayEnded(ended);
    });
  }, []);

  useEffect(() => {
    recheck();
    const sub = AppState.addEventListener("change", (status) => {
      if (status === "active") recheck();
    });
    return () => sub.remove();
  }, [recheck]);

  // Re-check on every focus so the tile is correct when returning to Home.
  useFocusEffect(recheck);

  // Keep the tile honest if the screen stays open across the IST-date rollover
  // (the day flag goes stale → tracking reads off).
  useEffect(() => {
    if (!dayOn) return;
    const id = setInterval(recheck, 60_000);
    return () => clearInterval(id);
  }, [dayOn, recheck]);

  const onStartDay = useCallback(async () => {
    setDayBusy(true);
    try {
      if (await runStartDayFlow(confirm, prompt)) {
        setDayOn(true);
        setDayEnded(false);
        // Day just started — open today's beat so the SE sees their stops.
        router.push("/beat");
      }
    } finally {
      setDayBusy(false);
    }
  }, [confirm, prompt]);

  const onEndDay = useCallback(async () => {
    const ok = await confirm({
      title: "End your day?",
      message: "This stops GPS tracking for today. You can't start again until tomorrow.",
      confirmLabel: "End day",
      cancelLabel: "Cancel",
      destructive: true,
    });
    if (!ok) return;

    // Mandatory ending odometer reading (must be HIGHER than the start reading
    // and within a plausible day distance). Prefer the server's authoritative
    // start_odometer; fall back to the value stored on this device when offline.
    // Cancelling leaves the day running.
    const start = (await getServerStartOdometer()) ?? (await getDayStartOdometer());
    const endOdometer = await promptOdometer(
      { prompt, confirm },
      {
        title: "Ending odometer",
        message: "Enter your vehicle's current odometer reading (km) to end the day.",
        greaterThan: start,
        minDistanceKm: MIN_DAY_DISTANCE_KM,
        maxDistanceKm: MAX_DAY_DISTANCE_KM,
        destructive: true, // End day stops tracking for the day — red Continue + red notices.
      },
    );
    if (endOdometer == null) return;

    setDayBusy(true);
    try {
      // Stop native GPS + close the server session (tagged a manual end) with the
      // ending odometer, then stamp today's local "ended" flag so the button
      // locks until tomorrow.
      await stopDayTracking({ endOdometer });
      await markDayEndedToday();
      if (mounted.current) {
        setDayOn(false);
        setDayEnded(true);
      }
    } finally {
      setDayBusy(false);
    }
  }, [confirm, prompt]);

  return { dayOn, dayEnded, dayBusy, onStartDay, onEndDay };
}
