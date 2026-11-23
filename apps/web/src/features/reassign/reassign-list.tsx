"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SearchSelect } from "@/features/orders/search-select";
import { ReassignListRow } from "./reassign-list-row";
import type { ReassignCustomerRow } from "./reassign-api";

const ALL = "__all";

/** The browsable customer list — this is the picker. Search + owner filter + rows. */
export function ReassignList({
  customers,
  total,
  selectedId,
  onSelect,
  search,
  setSearch,
  owners,
  owner,
  setOwner,
}: Readonly<{
  customers: ReassignCustomerRow[];
  total: number;
  selectedId: string;
  onSelect: (id: string) => void;
  search: string;
  setSearch: (v: string) => void;
  owners: { id: string; name: string }[];
  owner: string;
  setOwner: (v: string) => void;
}>) {
  return (
    <section className="h-fit rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-card-foreground">Customers</h2>
        <span className="text-xs text-muted-foreground">
          {customers.length === total ? total : `${customers.length} of ${total}`}
        </span>
      </div>
      <div className="flex gap-2 border-b border-border p-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, code or city…"
            className="h-9 bg-background pl-8"
          />
        </div>
        <div className="w-[150px]">
          <SearchSelect
            items={[{ id: ALL, name: "All owners" }, ...owners]}
            valueKey={owner || ALL}
            getKey={(o) => o.id}
            getLabel={(o) => o.name}
            onSelect={(v) => setOwner(v === ALL ? "" : v)}
            placeholder="All owners"
            searchPlaceholder="Search owner…"
            emptyText="No owners"
            contentClassName="w-[240px] p-0"
          />
        </div>
      </div>
      {customers.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">No customers match your search.</p>
      ) : (
        <div className="max-h-[520px] overflow-auto">
          {customers.map((c) => (
            <ReassignListRow key={c.id} customer={c} selected={c.id === selectedId} onSelect={() => onSelect(c.id)} />
          ))}
        </div>
      )}
    </section>
  );
}
