"use client";

import { SearchSelect } from "@/features/orders/search-select";

/** The Collection Dues card header: title + executive/city filters. */
export function DuesFilters({
  executiveId, city, salesExecutives, cities, onExec, onCity,
}: Readonly<{
  executiveId: string;
  city: string;
  salesExecutives: { id: string; name: string }[];
  cities: string[];
  onExec: (v: string) => void;
  onCity: (v: string) => void;
}>) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-sm font-semibold text-foreground">Collection Dues</h3>
      <div className="flex items-center gap-2">
        <div className="w-[180px]">
          <SearchSelect
            items={[{ id: "", name: "All executives" }, ...salesExecutives]}
            valueKey={executiveId}
            getKey={(x) => x.id}
            getLabel={(x) => x.name}
            onSelect={onExec}
            placeholder="All executives"
            searchPlaceholder="Search executive…"
            emptyText="No executives found"
            contentClassName="w-[220px] p-0"
          />
        </div>
        <div className="w-[170px]">
          <SearchSelect
            items={[{ id: "", name: "All cities" }, ...cities.map((c) => ({ id: c, name: c }))]}
            valueKey={city}
            getKey={(x) => x.id}
            getLabel={(x) => x.name}
            onSelect={onCity}
            placeholder="All cities"
            searchPlaceholder="Search city…"
            emptyText="No cities found"
            contentClassName="w-[220px] p-0"
          />
        </div>
      </div>
    </div>
  );
}
