"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import type { TrackedExecutive } from "./tracking-api";
import { fmtTime, isFresh } from "./tracking-helpers";
import { TrackingExecutiveRow } from "./tracking-executive-row";
import { TrackingExecutiveDetail } from "./tracking-executive-detail";

export function TrackingExecutiveList({
  executives, effectiveSelectedUserId, onSelect, lastUpdated, routePointCount,
}: {
  readonly executives: TrackedExecutive[];
  readonly effectiveSelectedUserId: string | null;
  readonly onSelect: (userId: string) => void;
  readonly lastUpdated: Date | null;
  readonly routePointCount: number;
}) {
  const [query, setQuery] = useState("");
  const selected = executives.find((e) => e.userId === effectiveSelectedUserId) ?? null;
  const q = query.trim().toLowerCase();
  const shown = q ? executives.filter((e) => e.name.toLowerCase().includes(q)) : executives;

  return (
    <div className="flex h-full w-[300px] min-h-0 shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-white shadow-sm">
      <div className="shrink-0 border-b border-border px-4 py-3">
        <p className="text-sm font-semibold">Executives on the road</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {executives.length === 0
            ? "No GPS data for this day"
            : `${executives.filter(isFresh).length} fresh · ${executives.length} tracked`}
          {lastUpdated && ` · updated ${fmtTime(lastUpdated.toISOString())}`}
        </p>
        {executives.length > 0 && (
          <div className="relative mt-2.5">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search executive…"
              className="w-full rounded-md border border-border bg-white py-1.5 pl-8 pr-2 text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/30"
            />
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {(() => { if (executives.length === 0) return (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Nothing to show — an executive appears here once they tap &ldquo;Start day&rdquo; in the mobile app.
          </p>
        ); if (shown.length === 0) return (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">No executive matches &ldquo;{query.trim()}&rdquo;.</p>
        ); return (
          shown.map((ex) => (
            <TrackingExecutiveRow key={ex.userId} ex={ex} selected={ex.userId === effectiveSelectedUserId} onSelect={onSelect} />
          ))
        ); })()}
      </div>
      {selected && <TrackingExecutiveDetail selected={selected} routePointCount={routePointCount} />}
    </div>
  );
}
