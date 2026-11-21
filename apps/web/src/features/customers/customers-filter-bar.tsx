"use client";

import { Input } from "@/components/ui/input";
import { SearchSelect } from "@/features/orders/search-select";
import { ALL, DUES_OPTIONS } from "./customers-list-logic";

/** Search box + City / Sales Executive / Collection-dues filters. */
export function CustomersFilterBar({
  search,
  setSearch,
  cities,
  salesExecutives,
  filterCity,
  filterSalesExec,
  filterDues,
  setFilter,
}: Readonly<{
  search: string;
  setSearch: (v: string) => void;
  cities: string[];
  salesExecutives: { id: string; name: string }[];
  filterCity: string;
  filterSalesExec: string;
  filterDues: string;
  setFilter: (key: "city" | "salesExecutiveId" | "dues", value: string) => void;
}>) {
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
    </div>
  );
}
