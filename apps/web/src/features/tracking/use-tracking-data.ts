"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet, type ActionConfig } from "@/lib/api-client";
import { useUrlState } from "@/lib/use-url-state";
import type { RoutePoint, TrackedExecutive, TrackingCheckin } from "./tracking-api";
import { EMPTY_POINTS, REFRESH_MS } from "./tracking-helpers";
import { useTrackingOverlays } from "./use-tracking-overlays";

const EMPTY_CHECKINS: TrackingCheckin[] = [];

interface Options {
  initialExecutives: TrackedExecutive[];
  initialDate: string;
  actionConfig: ActionConfig;
}

/** All Live-Tracking data + view state: the day's executives, the selected one's
 *  route + check-ins (polled live for today), map overlays, and device health.
 *  The view (map/health), selected date, and selected executive live in the URL
 *  (`replace`) so Back/refresh/share restore the exact screen. */
export function useTrackingData({ initialExecutives, initialDate, actionConfig }: Options) {
  const { get, set } = useUrlState();
  const date = get("date") || initialDate;
  const view: "map" | "health" = get("view") === "health" ? "health" : "map";
  const selectedUserId = get("se") || null;
  const setDate = (d: string) => set({ date: d === initialDate ? null : d });
  const setView = (v: "map" | "health") => set({ view: v === "map" ? null : v });
  const setSelectedUserId = (id: string | null) => set({ se: id });
  const isToday = date === initialDate;
  const pollInterval = isToday ? REFRESH_MS : false; // live view (today) polls; past days don't

  const executivesQuery = useQuery({
    queryKey: ["tracking-executives", date],
    queryFn: () => apiGet<{ executives: TrackedExecutive[] }>(actionConfig, `/tracking/executives?date=${date}`),
    initialData: isToday ? { executives: initialExecutives } : undefined,
    refetchInterval: pollInterval,
    placeholderData: (prev) => prev,
  });
  const executives = executivesQuery.data?.executives ?? initialExecutives;

  // Keep the selection if still present after a refresh, else fall back to the first.
  const effectiveSelectedUserId =
    selectedUserId && executives.some((e) => e.userId === selectedUserId) ? selectedUserId : executives[0]?.userId ?? null;

  const routeQuery = useQuery({
    queryKey: ["tracking-route", effectiveSelectedUserId, date],
    queryFn: () => apiGet<{ points: RoutePoint[] }>(actionConfig, `/tracking/route?userId=${effectiveSelectedUserId}&date=${date}`),
    enabled: !!effectiveSelectedUserId, refetchInterval: pollInterval, placeholderData: (prev) => prev,
  });
  const checkinsQuery = useQuery({
    queryKey: ["tracking-checkins", effectiveSelectedUserId, date],
    queryFn: () => apiGet<{ checkins: TrackingCheckin[] }>(actionConfig, `/tracking/checkins?userId=${effectiveSelectedUserId}&date=${date}`),
    enabled: !!effectiveSelectedUserId, refetchInterval: pollInterval, placeholderData: (prev) => prev,
  });

  const overlays = useTrackingOverlays(actionConfig, date, view, isToday);

  return {
    date, setDate, selectedUserId, setSelectedUserId, view, setView,
    executives, effectiveSelectedUserId,
    routePoints: routeQuery.data?.points ?? EMPTY_POINTS,
    routeStale: routeQuery.isPlaceholderData,
    checkins: checkinsQuery.data?.checkins ?? EMPTY_CHECKINS,
    lastUpdated: executivesQuery.dataUpdatedAt ? new Date(executivesQuery.dataUpdatedAt) : null,
    displayError:
      (executivesQuery.error instanceof Error ? executivesQuery.error.message : null) ??
      (routeQuery.error instanceof Error ? routeQuery.error.message : null),
    refetch: () => { void executivesQuery.refetch(); void routeQuery.refetch(); },
    ...overlays,
  };
}
