"use client";

import { RefreshCw } from "lucide-react";
import { DatePicker } from "@/features/expenditures/expenditure-date-picker";

/** Live-Tracking header: title, Map / Device-health toggle, date picker, refresh. */
export function TrackingHeader({
  view, setView, date, setDate, onRefresh,
}: {
  readonly view: "map" | "health";
  readonly setView: (v: "map" | "health") => void;
  readonly date: string;
  readonly setDate: (v: string) => void;
  readonly onRefresh: () => void;
}) {
  const tab = (v: "map" | "health", label: string) => (
    <button
      onClick={() => setView(v)}
      className={`rounded px-2.5 py-1 font-medium ${view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-2xl font-semibold">Live Tracking</h2>
        <p className="mt-1 text-sm text-muted-foreground">Field executives&apos; day routes</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border border-border bg-white p-0.5 text-sm">
          {tab("map", "Map")}
          {tab("health", "Device health")}
        </div>
        <DatePicker value={date} onChange={(v) => v && setDate(v)} disableFuture triggerClassName="w-[150px]" />
        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 rounded-md border border-border bg-white px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>
    </div>
  );
}
