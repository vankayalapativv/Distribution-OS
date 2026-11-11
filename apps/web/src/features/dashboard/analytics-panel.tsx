"use client";

import { TH, type CustomerRow, type CustomerSort } from "./analytics-types";

export function Panel({
  title,
  meta,
  children,
}: {
  readonly title: string;
  readonly meta?: React.ReactNode;
  readonly children: React.ReactNode;
}) {
  return (
    <section className="mb-6 overflow-hidden rounded-lg border border-border bg-white">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-5 py-3.5">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {meta ? <span className="text-xs text-muted-foreground">{meta}</span> : null}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

/**
 * Sortable table header. Hoisted to module scope (not defined inside the component)
 * so it keeps a stable identity across renders — otherwise React remounts the header
 * subtree and drops button focus every render.
 */
function sortArrow(dir: string): string {
  return dir === "desc" ? "↓" : "↑";
}

export function SortTh({
  label,
  field,
  numeric = true,
  sort,
  onSort,
}: {
  readonly label: string;
  readonly field: keyof CustomerRow;
  readonly numeric?: boolean;
  readonly sort: CustomerSort;
  readonly onSort: (key: keyof CustomerRow) => void;
}) {
  const on = sort.key === field;
  return (
    <th className={`${TH} ${numeric ? "text-right" : "text-left"}`}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className={`inline-flex items-center gap-1 uppercase tracking-wide transition-colors hover:text-foreground ${
          on ? "text-primary" : ""
        }`}
      >
        {label}
        <span className={on ? "text-primary" : "text-slate-400"}>
          {on ? sortArrow(sort.dir) : "⇅"}
        </span>
      </button>
    </th>
  );
}
