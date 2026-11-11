import { MapPin } from "lucide-react";

/**
 * Animated placeholder for the tracking map — shown while the map's code chunk
 * lazy-loads and its tiles initialise. Matches the map card's box so there's no
 * layout shift when the real map swaps in.
 */
export function MapLoadingOverlay({ label = "Loading map…" }: { readonly label?: string }) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-slate-100">
      {/* soft shimmer */}
      <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200/70" />
      {/* faint map-grid lines so it reads as a map, not a blank box */}
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgb(226 232 240) 1px, transparent 1px), linear-gradient(to bottom, rgb(226 232 240) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />
      <div className="relative flex h-full flex-col items-center justify-center gap-3">
        <span className="relative flex h-11 w-11 items-center justify-center">
          <span className="absolute inset-0 animate-spin rounded-full border-2 border-primary/15 border-t-primary/70" />
          <MapPin size={18} className="text-primary/70" />
        </span>
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

/** Full map card used as the `next/dynamic` loading fallback (before the chunk arrives). */
export function MapLoadingCard() {
  return (
    <div className="relative flex-1 overflow-hidden rounded-xl border border-border bg-white shadow-sm">
      <MapLoadingOverlay />
    </div>
  );
}
