"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchSelect } from "@/components/ui/search-select";
import type { ExpenditureCategory } from "./expenditures-api";
import type { ExpendituresListState } from "./use-expenditures-list";

const TYPE_FILTERS = [
  { value: "all", label: "All types" },
  { value: "compulsory", label: "Compulsory" },
  { value: "variable", label: "Variable" },
];

/**
 * Search + type + category filter bar (the period picker lives in the header).
 * Matches the sibling list pages: searchable selects for both the type and the
 * category list, and a Clear button when a filter is active.
 */
export function ExpenditureFilters({ s, categories }: Readonly<{ s: ExpendituresListState; categories: ExpenditureCategory[] }>) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <Input
        value={s.search}
        onChange={(e) => s.setSearch(e.target.value)}
        placeholder="Search code, category, payee…"
        className="h-9 w-56 bg-white"
      />
      <div className="w-[150px]">
        <SearchSelect
          items={TYPE_FILTERS}
          valueKey={s.typeFilter || "all"}
          getKey={(o) => o.value}
          getLabel={(o) => o.label}
          onSelect={(v) => s.setTypeFilter(v || "all")}
          placeholder="All types"
          searchPlaceholder="Search…"
          emptyText="No match"
          triggerClassName="bg-white"
          contentClassName="w-[180px] p-0"
        />
      </div>
      <div className="w-[200px]">
        <SearchSelect
          items={[{ id: "all", name: "All categories" }, ...categories.map((c) => ({ id: c.id, name: c.name }))]}
          valueKey={s.categoryFilter}
          getKey={(x) => x.id}
          getLabel={(x) => x.name}
          onSelect={(v) => s.setCategoryFilter(v || "all")}
          placeholder="All categories"
          searchPlaceholder="Search category…"
          emptyText="No categories found"
          contentClassName="w-[240px] p-0"
        />
      </div>
      {s.hasFilters ? (
        <Button variant="ghost" className="h-9" onClick={s.clearFilters}>Clear</Button>
      ) : null}
    </div>
  );
}
