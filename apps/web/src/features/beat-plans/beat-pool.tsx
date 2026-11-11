"use client";

import { useMemo, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { BeatSortableCard } from "./beat-card";
import { matchesQuery, type BeatCustomer } from "./beat-plans-api";

/** The "Unassigned" pool column: every customer on no day. Searchable, and a
 *  drop target so a stop dragged here leaves the beat entirely. */
export function BeatPool({ customers }: { readonly customers: BeatCustomer[] }) {
  const [query, setQuery] = useState("");
  const { setNodeRef, isOver } = useDroppable({ id: "pool" });
  const shown = useMemo(() => customers.filter((c) => matchesQuery(c, query)), [customers, query]);
  const ids = shown.map((c) => c.customerId);

  return (
    <div
      className={cn(
        "flex h-full min-h-0 w-[288px] shrink-0 flex-col rounded-xl border border-border bg-muted",
        isOver && "ring-2 ring-primary/40",
      )}
    >
      <header className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Unassigned
        </span>
        <span className="rounded-full bg-card px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
          {customers.length}
        </span>
      </header>

      <div className="shrink-0 px-2.5 pt-2.5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, phone, city…"
            className="h-8 w-full rounded-md border border-border bg-card pl-8 pr-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      <div ref={setNodeRef} className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2.5">
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {shown.length === 0 ? (
            <p className="py-8 text-center text-[11.5px] text-muted-foreground">
              {query ? "No matches" : "All customers assigned"}
            </p>
          ) : (
            shown.map((c) => <BeatSortableCard key={c.customerId} customer={c} seq={null} />)
          )}
        </SortableContext>
      </div>
    </div>
  );
}
