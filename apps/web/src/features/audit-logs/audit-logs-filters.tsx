"use client";

import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LazyCalendar } from "@/components/ui/lazy-calendar";
import { SearchSelect } from "@/features/orders/search-select";
import { AuditSelect } from "./audit-select";
import type { AuditFilterOptions } from "./audit-logs-api";
import type { AuditFiltersState } from "./use-audit-filters";
import { plural } from "@/lib/format";

/** The audit-log filter bar: search, person, record type, action, date range, clear. */
export function AuditLogsFilters({
  f,
  opts,
  isLoading,
  total,
}: {
  readonly f: AuditFiltersState;
  readonly opts: AuditFilterOptions | undefined;
  readonly isLoading: boolean;
  readonly total: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <Input
        value={f.search}
        onChange={(e) => f.setSearch(e.target.value)}
        placeholder="Search summary, record or person…"
        className="h-9 w-72 bg-white"
      />
      <div className="w-[180px]">
        <SearchSelect
          items={[{ id: "", name: "All people" }, ...(opts?.actors ?? [])]}
          valueKey={f.actorId}
          getKey={(x) => x.id}
          getLabel={(x) => x.name}
          onSelect={f.setActorId}
          placeholder="All people"
          searchPlaceholder="Search person…"
          emptyText="No people found"
          contentClassName="w-[240px] p-0"
        />
      </div>
      <AuditSelect value={f.entityType} onChange={f.setEntityType} options={opts?.entityTypes ?? []} allLabel="All records" width="w-[150px]" />
      <AuditSelect value={f.action} onChange={f.setAction} options={opts?.actions ?? []} allLabel="All actions" width="w-[190px]" />
      <Popover>
        <PopoverTrigger className="flex h-9 items-center gap-2 rounded-md border border-input bg-white px-3 text-sm transition-colors hover:bg-accent focus:outline-none">
          <CalendarIcon size={14} className="shrink-0 opacity-50" />
          <span className={f.dateRange?.from ? "text-foreground" : "text-muted-foreground"}>{f.dateLabel}</span>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <LazyCalendar mode="range" selected={f.dateRange} onSelect={f.setDateRange} numberOfMonths={2} />
        </PopoverContent>
      </Popover>
      {f.hasFilters ? (
        <Button variant="ghost" className="h-9" onClick={f.reset}>Clear</Button>
      ) : null}
      <div className="ml-auto text-xs text-muted-foreground">
        {isLoading ? "Loading…" : `${total} result${plural(total)}`}
      </div>
    </div>
  );
}
