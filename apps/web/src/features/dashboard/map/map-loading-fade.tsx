"use client";

import { MapLoadingOverlay } from "@/features/tracking/tracking-map-loading";

/** The loading overlay that cross-fades out once the map is `ready`, then calls
 *  `onGone` when its OWN opacity transition finishes (so the parent can unmount
 *  it and stop the spinner). CSS cross-fade — no animation library. */
export function MapLoadingFade({ ready, onGone }: { readonly ready: boolean; readonly onGone: () => void }) {
  return (
    <div
      className={`absolute inset-0 transition-opacity duration-[350ms] ease-out ${
        ready ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      onTransitionEnd={(e) => {
        // Only the overlay's own opacity fade-out drops it (ignore bubbled transitions).
        if (ready && e.target === e.currentTarget && e.propertyName === "opacity") onGone();
      }}
    >
      <MapLoadingOverlay />
    </div>
  );
}
