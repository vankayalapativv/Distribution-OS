"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "maplibre-gl/dist/maplibre-gl.css";
import { IndiaMap, type MapMarker } from "vardhan-maps/react";
import { guardMaplibreLeaflet } from "@/lib/maplibre-leaflet-guard";
import {
  REGION_BOUNDS, HYDERABAD_DISTRICT_SET, HYDERABAD_DISTRICTS_CENTER, HYDERABAD_DISTRICTS_ZOOM,
} from "@/features/dashboard/map/map-constants";
import { bandMeta, type DuesBand, type MapCustomer } from "@/features/dashboard/map/map-helpers";
import type { RoutePoint, TrackedExecutive, TrackingCheckin } from "./tracking-api";
import { MapLoadingOverlay } from "./tracking-map-loading";
import { checkinMarkers, customerMarkers } from "./tracking-map-markers";
import {
  buildRoutes, CUSTOMER_DISTRICT, CUSTOMER_STATES, execForMarker, execMarkers, fitKeyOf,
  HIDDEN_DISTRICT, READY_FALLBACK_MS, STATE_OUTLINE,
} from "./tracking-map-model";

interface TrackingMapProps {
  readonly executives: TrackedExecutive[];
  readonly routePoints: RoutePoint[];
  readonly routeStale?: boolean;
  readonly customers: MapCustomer[];
  readonly bands?: DuesBand[];
  readonly checkins: TrackingCheckin[];
  readonly onSelectExecutive: (userId: string) => void;
  readonly selectedUserId?: string | null;
  readonly customerDistricts?: string[];
}

export function TrackingMap({ executives, routePoints, routeStale, customers, bands, checkins, onSelectExecutive, selectedUserId, customerDistricts }: TrackingMapProps) {
  const meta = useMemo(() => bandMeta(bands), [bands]);
  const selectedExec = useMemo(
    () => executives.find((e) => e.userId === selectedUserId && e.lastLatitude != null && e.lastLongitude != null),
    [executives, selectedUserId],
  );
  const routeReady = !routeStale && routePoints.length >= 2;

  // Layer order: customer dots (bottom) → executive markers → visit flags (top).
  // A visited customer is shown ONLY as its visit flag (its dues dot is dropped);
  // the flag's popup carries the full customer block + the visit details. Flags
  // are hidden while the route is stale, so the previous person's don't linger
  // (and in that gap the visited customers fall back to their plain dues dots).
  const markers = useMemo<MapMarker[]>(() => {
    const shownCheckins = routeStale ? [] : checkins;
    const visitedIds = new Set(shownCheckins.map((c) => c.customerId));
    const byId = new Map(customers.map((c) => [c.id, c]));
    return [
      ...customerMarkers(customers.filter((c) => !visitedIds.has(c.id)), meta),
      ...execMarkers(executives),
      ...checkinMarkers(shownCheckins, byId, meta),
    ];
  }, [customers, executives, checkins, routeStale, meta]);
  const routes = useMemo(() => buildRoutes(routePoints, routeReady, selectedExec), [routePoints, routeReady, selectedExec]);

  const customerSet = useMemo(() => new Set(customerDistricts ?? []), [customerDistricts]);
  // Always outline the four operating districts for context; hide the rest.
  const districtFill = (name: string) => (HYDERABAD_DISTRICT_SET.has(name) ? CUSTOMER_DISTRICT : HIDDEN_DISTRICT);
  // Auto-fit to the day's tracking data when there is any; otherwise open on the
  // four-district Hyderabad view.
  const hasData = markers.length > 0 || routes.length > 0;
  const fitKey = fitKeyOf(routeReady, routePoints, selectedUserId);

  const onMarkerClick = (m: MapMarker) => {
    const ex = execForMarker(executives, m);
    if (ex) onSelectExecutive(ex.userId);
  };

  // Reveal the map only once its basemap is fully painted (onRenderComplete); a
  // fallback flips it after READY_FALLBACK_MS so a failed tile load can't hang it.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), READY_FALLBACK_MS);
    return () => clearTimeout(t);
  }, []);

  // vardhan-maps loads the maplibre-gl-leaflet plugin internally; guard its
  // prototype (shared with the dashboard map) against the teardown getZoom race
  // as soon as it registers. Idempotent; stops once applied.
  useEffect(() => {
    if (guardMaplibreLeaflet(L)) return;
    let tries = 0;
    const id = setInterval(() => {
      if (guardMaplibreLeaflet(L) || (tries += 1) > 50) clearInterval(id);
    }, 100);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative flex-1 overflow-hidden rounded-xl border border-border bg-white shadow-sm">
      <IndiaMap
        mode="leaflet" level="both" vector
        workerUrl="/maplibre-gl-worker.mjs"
        stateNames={CUSTOMER_STATES} lockBounds={REGION_BOUNDS}
        center={HYDERABAD_DISTRICTS_CENTER} zoom={HYDERABAD_DISTRICTS_ZOOM}
        clipToStates maskStates={CUSTOMER_STATES} attributionPrefix="" fitTo={hasData ? "data" : "none"} fitKey={fitKey}
        boundaryTooltips={false} stateStyle={STATE_OUTLINE} districtFill={districtFill}
        dataKey={[...customerSet].sort((a, b) => a.localeCompare(b)).join("|")}
        markers={markers} routes={routes} onMarkerClick={onMarkerClick} onRenderComplete={() => setReady(true)}
        style={{ position: "absolute", inset: 0 }}
      />
      {/* Content cross-fade veil, replayed on each executive change (never blocks the map). */}
      <motion.div
        key={selectedUserId ?? "none"} aria-hidden className="pointer-events-none absolute inset-0 z-[650] bg-white"
        initial={{ opacity: 0.16 }} animate={{ opacity: 0 }} transition={{ duration: 0.55, ease: "easeOut" }}
      />
      <AnimatePresence>
        {!ready && (
          <motion.div className="absolute inset-0 z-[700]" initial={{ opacity: 1 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35, ease: "easeOut" }}>
            <MapLoadingOverlay />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
