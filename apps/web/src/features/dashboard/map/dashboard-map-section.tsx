"use client";

/** Dashboard "Customers Map" section (SUPER_ADMIN + MANAGER): every active
 *  customer aggregated to a per-district total on an OpenStreetMap of Telangana
 *  (the client operates in Greater Hyderabad). The heavy Leaflet map + its data load only once the section
 *  scrolls into view; while it initialises it shows the SAME loading overlay as
 *  the Live Tracking map, for a consistent minimum on every load (even cached),
 *  then cross-fades to the map. */
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { apiGet, errorMessage, type ActionConfig } from "@/lib/api-client";
import { type DuesBand, type MapCustomer } from "./map-helpers";
import { MapLoadingOverlay } from "@/features/tracking/tracking-map-loading";
import { useInViewport } from "./use-in-viewport";

const OsmMap = dynamic(() => import("./osm-map").then((m) => m.OsmMap), {
  ssr: false,
  loading: () => <MapLoadingOverlay />,
});

// Safety net: reveal after this long even if the map's render-complete signal
// never fires (e.g. tiles fail), so the loader can't get stuck.
const READY_FALLBACK_MS = 10_000;

export function DashboardMapSection({ actionConfig }: { readonly actionConfig: ActionConfig }) {
  const { ref, inView } = useInViewport();

  const customersQuery = useQuery({
    queryKey: ["dashboard-map"],
    queryFn: () => apiGet<{ customers: MapCustomer[]; bands: DuesBand[] }>(actionConfig, "/dashboard/map"),
    staleTime: 300_000,
    enabled: inView, // don't fetch until the section is on screen
  });

  const customers = useMemo(() => customersQuery.data?.customers ?? [], [customersQuery.data]);
  const bands = customersQuery.data?.bands;

  const showMap = inView && customersQuery.isSuccess; // mount the map so it can initialise under the overlay

  // Reveal ONLY once the map is completely loaded — its basemap fully rendered
  // (all tiles painted, via OsmMap's onRenderComplete). A fallback flips it after
  // READY_FALLBACK_MS so a failed tile load can't leave the loader up forever.
  const [mapRendered, setMapRendered] = useState(false);
  useEffect(() => {
    if (!showMap) return;
    const t = setTimeout(() => setMapRendered(true), READY_FALLBACK_MS);
    return () => clearTimeout(t);
  }, [showMap]);

  const ready = showMap && mapRendered; // then reveal it

  // Keep the loading overlay mounted until its fade-out completes, then drop it
  // (so its spinner stops running). CSS cross-fade — no animation library.
  const [overlayGone, setOverlayGone] = useState(false);

  // Nearly full-viewport-height (minus the top bar + a little breathing room):
  // the heading sits on top and the map fills the rest, inside the card's padding.
  return (
    <section className="mb-7 flex h-[calc(100vh-7rem)] flex-col rounded-xl border border-border bg-white p-5 shadow-sm">
      <h3 className="mb-3 shrink-0 text-sm font-semibold text-foreground">Customers Map</h3>

      {/* `isolate` keeps Leaflet's high z-index panes/controls in their own
          stacking context; `relative` anchors the absolute loading overlay.
          `min-h-0 flex-1` lets the map fill the remaining height. */}
      <div
        ref={ref}
        className="relative isolate min-h-0 w-full flex-1 overflow-hidden rounded-lg border border-border"
      >
        {customersQuery.isError ? (
          <p className="flex h-full items-center justify-center px-4 text-center text-sm text-destructive">
            {errorMessage(customersQuery.error, "Could not load the map.")}
          </p>
        ) : (
          <>
            {showMap && (
              <div
                className={`h-full w-full transition-opacity duration-[400ms] ease-out ${
                  ready ? "opacity-100" : "opacity-0"
                }`}
              >
                <OsmMap customers={customers} bands={bands} onRenderComplete={() => setMapRendered(true)} />
              </div>
            )}
            {!overlayGone && (
              <div
                className={`absolute inset-0 transition-opacity duration-[350ms] ease-out ${
                  ready ? "pointer-events-none opacity-0" : "opacity-100"
                }`}
                onTransitionEnd={(e) => {
                  // Only the overlay's own opacity fade-out drops it (ignore bubbled transitions).
                  if (ready && e.target === e.currentTarget && e.propertyName === "opacity") {
                    setOverlayGone(true);
                  }
                }}
              >
                <MapLoadingOverlay />
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
