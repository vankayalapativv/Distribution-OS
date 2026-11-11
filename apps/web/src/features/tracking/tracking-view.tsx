"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { DashboardShell } from "@/features/shell/dashboard-shell";
import { ApiRequestError, isNonRetryableStatus, type ActionConfig } from "@/lib/api-client";
import type { TrackedExecutive } from "./tracking-api";
import { useTrackingData } from "./use-tracking-data";
import { TrackingHeader } from "./tracking-header";
import { TrackingExecutiveList } from "./tracking-executive-list";
import { TrackingDeviceHealth } from "./tracking-device-health";
import { MapLoadingCard } from "./tracking-map-loading";

// Lazy-load the map (Leaflet + tiles) so its chunk only downloads on this page (never SSR).
const TrackingMap = dynamic(() => import("./tracking-map").then((m) => m.TrackingMap), {
  ssr: false,
  loading: () => <MapLoadingCard />,
});

export type TrackingRole = "SUPER_ADMIN" | "MANAGER";

interface TrackingViewProps {
  readonly initialExecutives: TrackedExecutive[];
  readonly initialDate: string;
  readonly role: TrackingRole;
  readonly actionConfig: ActionConfig;
}

function TrackingViewInner({ initialExecutives, initialDate, role, actionConfig }: TrackingViewProps) {
  const t = useTrackingData({ initialExecutives, initialDate, actionConfig });

  return (
    <DashboardShell role={role} active="tracking" contentClassName="flex h-[calc(100vh-3.5rem)] flex-col gap-4 overflow-hidden px-8 py-6">
      <TrackingHeader view={t.view} setView={t.setView} date={t.date} setDate={t.setDate} onRefresh={t.refetch} />

      {t.displayError && (
        <div className="shrink-0 rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{t.displayError}</div>
      )}

      {t.view === "map" ? (
        <div className="flex min-h-0 flex-1 gap-5">
          <TrackingExecutiveList
            executives={t.executives}
            effectiveSelectedUserId={t.effectiveSelectedUserId}
            onSelect={t.setSelectedUserId}
            lastUpdated={t.lastUpdated}
            routePointCount={t.routePoints.length}
          />
          <TrackingMap
            executives={t.executives}
            routePoints={t.routePoints}
            // True only in the gap right after selecting a new executive, while their
            // route is still loading — the map flies to the new person immediately.
            routeStale={t.routeStale}
            customers={t.customers}
            checkins={t.checkins}
            customerDistricts={t.customerDistricts}
            selectedUserId={t.effectiveSelectedUserId}
            onSelectExecutive={t.setSelectedUserId}
          />
        </div>
      ) : (
        <TrackingDeviceHealth devices={t.deviceHealth} />
      )}
    </DashboardShell>
  );
}

/** Provides a scoped TanStack Query client for the live-tracking polling queries. */
export function TrackingView(props: TrackingViewProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            // Don't retry a billing block (402) or other 4xx; only transient failures.
            retry: (failureCount, error) => {
              if (error instanceof ApiRequestError && isNonRetryableStatus(error.status)) return false;
              return failureCount < 1;
            },
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <TrackingViewInner {...props} />
    </QueryClientProvider>
  );
}
