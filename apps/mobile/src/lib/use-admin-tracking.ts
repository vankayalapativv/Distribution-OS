import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect } from "expo-router";
import {
  fetchCheckins,
  fetchExecutiveRoute,
  fetchMapCustomers,
  fetchTrackedExecutives,
  istToday,
  type CheckinMarker,
  type DuesBand,
  type MapCustomer,
  type RoutePoint,
  type TrackedExecutive,
} from "./admin-tracking";
import { usePullRefresh } from "./use-pull-refresh";

/** State + effects for the Super Admin tracking screen: focus-polled executives,
 *  the selected rep's route, and the on-map marker projection. */
export function useAdminTracking() {
  const [date, setDate] = useState(istToday());
  const [execs, setExecs] = useState<TrackedExecutive[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [route, setRoute] = useState<RoutePoint[]>([]);
  // Which rep+date the loaded `route` belongs to. While it differs from the
  // current selection, the route in hand is the previous rep's — so the map flies
  // straight to the newly-selected rep's marker instead of waiting on the fetch.
  const [routeFor, setRouteFor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Always-on customer layer (coloured by dues bucket) + the selected rep's
  // check-ins for the day. Customers come from /dashboard/map (not date-scoped);
  // check-ins follow the selected rep + date, like the route.
  const [customers, setCustomers] = useState<MapCustomer[]>([]);
  // The enterprise's dues bands (ordinal order) — labels for the pin cards.
  const [bands, setBands] = useState<DuesBand[]>([]);
  const [checkins, setCheckins] = useState<CheckinMarker[]>([]);

  const load = useCallback(async () => {
    try {
      // Execs and customers load together; a customer-fetch failure never blanks
      // the reps (and vice versa) — each keeps its own last-good layer.
      const [ex, cu] = await Promise.all([
        fetchTrackedExecutives(date),
        fetchMapCustomers().catch(() => null),
      ]);
      setExecs(ex);
      if (cu) {
        setCustomers(cu.customers);
        setBands(cu.bands);
      }
    } catch {
      setExecs([]);
    } finally {
      setLoading(false);
    }
  }, [date]);

  // Load on focus + poll every 60s (only while focused).
  useFocusEffect(
    useCallback(() => {
      void load();
      const id = setInterval(() => void load(), 60_000);
      return () => clearInterval(id);
    }, [load]),
  );

  // Route follows the selected rep + date.
  useEffect(() => {
    if (!selectedId) {
      setRoute([]);
      setRouteFor(null);
      return;
    }
    let cancelled = false;
    const forKey = `${selectedId}|${date}`;
    void fetchExecutiveRoute(selectedId, date).then((pts) => {
      if (!cancelled) {
        setRoute(pts);
        setRouteFor(forKey);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selectedId, date]);

  // Check-ins follow the selected rep + date (none when nobody is selected).
  useEffect(() => {
    if (!selectedId) {
      setCheckins([]);
      return;
    }
    let cancelled = false;
    void fetchCheckins(selectedId, date)
      .then((cs) => {
        if (!cancelled) setCheckins(cs);
      })
      .catch(() => {
        if (!cancelled) setCheckins([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, date]);

  // Pull-to-refresh: reload the executives (and the selected rep's route) with
  // the pull spinner — no shimmer (a map can't skeleton). Focus poll continues.
  const { refreshing, onRefresh } = usePullRefresh(async () => {
    await load();
    if (selectedId) {
      setRoute(await fetchExecutiveRoute(selectedId, date));
      setRouteFor(`${selectedId}|${date}`);
    }
  });

  // Reps with a known position — these are the markers on the map.
  const visible = useMemo(
    () => execs.filter((e) => e.lastLatitude != null && e.lastLongitude != null),
    [execs],
  );

  // Map fitting is handled inside the map (IndiaMapNative fitTo="data" + fitKey),
  // so no imperative fitToCoordinates here anymore.

  // The loaded route is stale (previous rep's) whenever a rep is selected but the
  // route in hand isn't for that rep+date yet — the just-selected loading gap.
  const routeStale = selectedId != null && routeFor !== `${selectedId}|${date}`;

  return {
    date, setDate, execs, selectedId, setSelectedId,
    route, routeStale, loading, refreshing, onRefresh, visible,
    customers, bands, checkins,
  };
}
