"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Download, MoreVertical } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SearchSelect } from "@/features/orders/search-select";
import { cn } from "@/lib/utils";
import { ALL, DUES_OPTIONS } from "./customers-list-logic";

/** Search box + City / Sales Executive / Collection-dues filters + an actions
 *  kebab (⋮ → Download as PDF). */
export function CustomersFilterBar({
  search,
  setSearch,
  cities,
  salesExecutives,
  filterCity,
  filterSalesExec,
  filterDues,
  setFilter,
  onDownload,
  downloadDisabled,
  downloading,
}: Readonly<{
  search: string;
  setSearch: (v: string) => void;
  cities: string[];
  salesExecutives: { id: string; name: string }[];
  filterCity: string;
  filterSalesExec: string;
  filterDues: string;
  setFilter: (key: "city" | "salesExecutiveId" | "dues", value: string) => void;
  onDownload: () => void;
  downloadDisabled: boolean;
  downloading: boolean;
}>) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <Input
        placeholder="Search by name, phone, or code…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-9 w-72 bg-white"
      />
      <div className="w-[190px]">
        <SearchSelect
          items={[{ id: "", name: "All cities" }, ...cities.map((c) => ({ id: c, name: c }))]}
          valueKey={filterCity}
          getKey={(x) => x.id}
          getLabel={(x) => x.name}
          onSelect={(v) => setFilter("city", v)}
          placeholder="All cities"
          searchPlaceholder="Search city…"
          emptyText="No cities found"
          contentClassName="w-[240px] p-0"
        />
      </div>
      <div className="w-[200px]">
        <SearchSelect
          items={[{ id: "", name: "All executives" }, ...salesExecutives]}
          valueKey={filterSalesExec}
          getKey={(x) => x.id}
          getLabel={(x) => x.name}
          onSelect={(v) => setFilter("salesExecutiveId", v)}
          placeholder="All executives"
          searchPlaceholder="Search executive…"
          emptyText="No executives found"
          contentClassName="w-[240px] p-0"
        />
      </div>
      <div className="w-[160px]">
        <SearchSelect
          items={DUES_OPTIONS}
          valueKey={filterDues || ALL}
          getKey={(o) => o.value}
          getLabel={(o) => o.label}
          onSelect={(v) => setFilter("dues", v === ALL ? "" : v)}
          placeholder="All dues"
          searchPlaceholder="Search…"
          emptyText="No match"
          contentClassName="w-[180px] p-0"
        />
      </div>
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger
          title="Actions"
          className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-white text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <MoreVertical className="size-4" />
        </PopoverTrigger>
        <PopoverContent align="end" side="bottom" className="w-48 p-1.5">
          <button
            type="button"
            disabled={downloadDisabled || downloading}
            onClick={() => {
              // Keep the menu open so the "Preparing…" state is visible; it can be
              // dismissed by clicking away while the PDF is being built.
              onDownload();
            }}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-accent disabled:pointer-events-none disabled:opacity-40",
            )}
          >
            <Download className="size-4" />
            {downloading ? "Preparing…" : "Download as PDF"}
          </button>
        </PopoverContent>
      </Popover>
    </div>
  );
}
