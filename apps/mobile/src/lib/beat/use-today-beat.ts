/**
 * Online-only hook for today's beat. Fetches on focus, exposes a manual
 * refresh for pull-to-refresh. Shared by the beat screen, the stop-detail
 * screen and the Home beat card. No offline cache.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useAuth } from "../auth";
import { fetchTodayBeat, type TodayBeat } from "./today-beat-online";

export function useTodayBeat() {
  const token = useAuth((s) => s.token);
  const [beat, setBeat] = useState<TodayBeat | null>(null);
  const [loading, setLoading] = useState(true);

  // load() runs on focus + on manual refresh, so its resolve can land after the
  // screen unmounts — guard the setState.
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const load = useCallback(async () => {
    try {
      const next = await fetchTodayBeat(token);
      if (mounted.current) setBeat(next);
    } catch {
      // Keep whatever we last showed; online-only, no cache to fall back to.
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return { beat, loading, refresh: load };
}
