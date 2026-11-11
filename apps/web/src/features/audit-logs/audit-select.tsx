"use client";

import { SearchSelect } from "@/components/ui/search-select";

/** A compact "All X / one of a string list" searchable filter select (maps the
 *  "all" item to ""). */
export function AuditSelect({
  value,
  onChange,
  options,
  allLabel,
  width,
}: {
  readonly value: string;
  readonly onChange: (v: string) => void;
  readonly options: string[];
  readonly allLabel: string;
  readonly width: string;
}) {
  const items = [{ value: "all", label: allLabel }, ...options.map((o) => ({ value: o, label: o }))];
  return (
    <div className={width}>
      <SearchSelect
        items={items}
        valueKey={value || "all"}
        getKey={(o) => o.value}
        getLabel={(o) => o.label}
        onSelect={(v) => onChange(!v || v === "all" ? "" : v)}
        placeholder={allLabel}
        searchPlaceholder="Search…"
        emptyText="No match"
        triggerClassName="bg-white"
        contentClassName="w-[220px] p-0"
      />
    </div>
  );
}
