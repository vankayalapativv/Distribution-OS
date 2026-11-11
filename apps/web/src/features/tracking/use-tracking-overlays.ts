"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet, type ActionConfig } from "@/lib/api-client";
import { districtOf } from "@/features/dashboard/map/district-helpers";
import { TELANGANA_DISTRICTS } from "@/features/dashboard/map/telangana-districts";
import type { MapCustomer } from "@/features/dashboard/map/map-helpers";
import type { DeviceHealth } from "./tracking-api";
import { REFRESH_MS } from "./tracking-helpers";

const EMPTY_CUSTOMERS: MapCustomer[] = [];

/** Map overlays that aren't tied to the selected executive: the customer feed
 *  (+ the districts they fall in, for the border overlay) and the device-health
 *  roster (only fetched when the health view is open). */
export function useTrackingOverlays(actionConfig: ActionConfig, date: string, view: "map" | "health", isToday: boolean) {
  const customersQuery = useQuery({
    queryKey: ["tracking-customer-map"],
    queryFn: () => apiGet<{ customers: MapCustomer[] }>(actionConfig, "/dashboard/map"),
    staleTime: 300_000,
  });
  const customers = customersQuery.data?.customers ?? EMPTY_CUSTOMERS;

  const customerDistricts = useMemo(() => {
    const set = new Set<string>();
    for (const c of customers) {
      const d = districtOf(TELANGANA_DISTRICTS.features, c.lng, c.lat);
      if (d) set.add(d);
    }
    return [...set];
  }, [customers]);

  const deviceHealthQuery = useQuery({
    queryKey: ["tracking-device-health", date],
    queryFn: () => apiGet<{ devices: DeviceHealth[] }>(actionConfig, `/tracking/device-health?date=${date}`),
    enabled: view === "health",
    refetchInterval: isToday && view === "health" ? REFRESH_MS : false,
    placeholderData: (prev) => prev,
  });

  return { customers, customerDistricts, deviceHealth: deviceHealthQuery.data?.devices ?? [] };
}
