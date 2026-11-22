"use client";

import { Input } from "@/components/ui/input";
import { SearchSelect } from "@/features/orders/search-select";
import { ALL, ROLE_FILTER_OPTIONS, STATUS_FILTER_OPTIONS } from "./super-admin-list-logic";

/** Search box + Role / Status filters for the Users list. */
export function UsersFilterBar({
  search,
  setSearch,
  filterRole,
  filterStatus,
  setFilter,
}: Readonly<{
  search: string;
  setSearch: (v: string) => void;
  filterRole: string;
  filterStatus: string;
  setFilter: (key: "role" | "status", value: string) => void;
}>) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <Input
        placeholder="Search name, email or phone…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-9 w-72 bg-background"
      />
      <div className="w-[180px]">
        <SearchSelect
          items={ROLE_FILTER_OPTIONS}
          valueKey={filterRole || ALL}
          getKey={(o) => o.value}
          getLabel={(o) => o.label}
          onSelect={(v) => setFilter("role", v === ALL ? "" : v)}
          placeholder="All roles"
          searchPlaceholder="Search role…"
          emptyText="No role found"
          contentClassName="w-[200px] p-0"
        />
      </div>
      <div className="w-[160px]">
        <SearchSelect
          items={STATUS_FILTER_OPTIONS}
          valueKey={filterStatus || ALL}
          getKey={(o) => o.value}
          getLabel={(o) => o.label}
          onSelect={(v) => setFilter("status", v === ALL ? "" : v)}
          placeholder="All statuses"
          searchPlaceholder="Search…"
          emptyText="No status found"
          contentClassName="w-[180px] p-0"
        />
      </div>
    </div>
  );
}
