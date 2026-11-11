"use client";

import { format } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LazyCalendar } from "@/components/ui/lazy-calendar";
import { SearchSelect } from "@/components/ui/search-select";
import { COLLECTION_STATUSES } from "./collections-list-logic";
import type { Collector } from "./collections-types";
import { plural } from "@/lib/format";

interface Props {
  statusFilter: string;
  onStatus: (v: string) => void;
  search: string;
  setSearch: (v: string) => void;
  collectors: Collector[];
  collectedBy: string;
  onCollectedBy: (v: string) => void;
  collectionDate: Date | undefined;
  dateOpen: boolean;
  setDateOpen: (v: boolean) => void;
  onDate: (d: Date | undefined) => void;
  customerId: string;
  customerName: string | null;
  onClearCustomer: () => void;
  hasFilters: boolean;
  onClear: () => void;
  total: number;
  isLoading: boolean;
}

/** Collections list filter row — status / search / collector / date + chips. */
export function CollectionsFilterBar(p: Readonly<Props>) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <div className="w-[150px]">
        <SearchSelect
          items={COLLECTION_STATUSES}
          valueKey={p.statusFilter || "all"}
          getKey={(o) => o.value}
          getLabel={(o) => o.label}
          onSelect={(v) => p.onStatus(!v || v === "all" ? "" : v)}
          placeholder="All collections"
          searchPlaceholder="Search…"
          emptyText="No match"
          triggerClassName="bg-white"
          contentClassName="w-[180px] p-0"
        />
      </div>
      <Input
        value={p.search}
        onChange={(e) => p.setSearch(e.target.value)}
        placeholder="Search code or customer…"
        className="h-9 w-64 bg-white"
      />
      <div className="w-[190px]">
        <SearchSelect
          items={[{ id: "", name: "All executives" }, ...p.collectors.map((c) => ({ id: c.id, name: c.name }))]}
          valueKey={p.collectedBy}
          getKey={(x) => x.id}
          getLabel={(x) => x.name}
          onSelect={p.onCollectedBy}
          placeholder="All executives"
          searchPlaceholder="Search executive…"
          emptyText="No executives found"
          contentClassName="w-[240px] p-0"
        />
      </div>
      <Popover open={p.dateOpen} onOpenChange={p.setDateOpen}>
        <PopoverTrigger className="flex h-9 items-center gap-2 rounded-md border border-input bg-white px-3 text-sm transition-colors hover:bg-accent focus:outline-none">
          <CalendarIcon size={14} className="shrink-0 opacity-50" />
          <span className={p.collectionDate ? "text-foreground" : "text-muted-foreground"}>
            {p.collectionDate ? format(p.collectionDate, "dd MMM yyyy") : "Any date"}
          </span>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <LazyCalendar mode="single" selected={p.collectionDate} onSelect={p.onDate} />
        </PopoverContent>
      </Popover>
      {p.hasFilters && <Button variant="ghost" className="h-9" onClick={p.onClear}>Clear</Button>}
      {p.customerId && (
        <button type="button" onClick={p.onClearCustomer}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-accent px-3 text-sm text-foreground hover:bg-accent/70">
          Customer: <span className="font-medium">{p.customerName ?? "selected"}</span>
          <X className="size-3.5 text-muted-foreground" />
        </button>
      )}
      <div className="ml-auto text-xs text-muted-foreground">
        {p.isLoading ? "Loading…" : `${p.total} result${plural(p.total)}`}
      </div>
    </div>
  );
}
