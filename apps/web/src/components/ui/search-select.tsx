"use client";

import { useState, type ReactNode } from "react";
import { ChevronsUpDown } from "lucide-react";
import { SearchCombobox } from "@/components/ui/search-combobox";

/**
 * The canonical single-field searchable select: type to filter, panel rendered
 * in a Popover (so it isn't clipped by a dialog's overflow like a plain Select
 * would be). Used app-wide for any dropdown backed by a list of options —
 * filters, pickers, enum choices. Server-search variants (customers) compose
 * `SearchCombobox` directly instead.
 */
export function SearchSelect<T>({
  items,
  valueKey,
  getKey,
  getLabel,
  onSelect,
  placeholder,
  searchPlaceholder,
  emptyText,
  contentClassName,
  renderOption,
  renderTrigger,
  triggerClassName,
  disabled,
  loading,
}: {
  readonly items: T[];
  readonly valueKey: string;
  readonly getKey: (item: T) => string;
  readonly getLabel: (item: T) => string;
  readonly onSelect: (key: string) => void;
  readonly placeholder: string;
  readonly searchPlaceholder: string;
  readonly emptyText: string;
  readonly contentClassName: string;
  /** Custom rendering for each list option (trigger still shows getLabel). */
  readonly renderOption?: (item: T) => ReactNode;
  /** Custom trigger content (replaces the default label span; chevron kept).
   *  Receives the selected item, or undefined when nothing is selected. */
  readonly renderTrigger?: (selected: T | undefined) => ReactNode;
  /** Extra trigger classes (e.g. a background or width). */
  readonly triggerClassName?: string;
  readonly disabled?: boolean;
  /** Show the shimmer placeholder in the panel while options are still loading
   *  (e.g. a picker whose catalogue is fetched on first open). */
  readonly loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();
  // Match on substring, but rank items that START WITH the query ahead of ones
  // that merely contain it — so typing "m" shows "Mancherial" before "Bayyaram".
  // Array.sort is stable (ES2019+), so each group keeps its original order.
  const filtered = q
    ? items
        .filter((it) => getLabel(it).toLowerCase().includes(q))
        .sort(
          (a, b) =>
            Number(getLabel(b).toLowerCase().startsWith(q)) -
            Number(getLabel(a).toLowerCase().startsWith(q)),
        )
    : items;
  const selected = items.find((it) => getKey(it) === valueKey);

  return (
    <SearchCombobox
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setSearch("");
      }}
      disabled={disabled}
      triggerLabel={
        <>
          {renderTrigger ? (
            renderTrigger(selected)
          ) : (
            <span className={`truncate ${selected ? "text-foreground" : "text-muted-foreground"}`}>
              {selected ? getLabel(selected) : placeholder}
            </span>
          )}
          <ChevronsUpDown size={14} className="shrink-0 opacity-40" />
        </>
      }
      triggerClassName={`h-9 ${triggerClassName ?? ""}`}
      contentClassName={contentClassName}
      registerSearchInput={(el) => {
        if (el) requestAnimationFrame(() => el.focus());
      }}
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder={searchPlaceholder}
      searchClassName="h-8 text-sm"
      items={filtered}
      getKey={getKey}
      isSelected={(it) => getKey(it) === valueKey}
      onSelect={(it) => {
        onSelect(getKey(it));
        setOpen(false);
        setSearch("");
      }}
      renderItem={renderOption ?? ((it) => getLabel(it))}
      itemClassName="flex w-full items-center px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
      emptyText={emptyText}
      loading={loading}
    />
  );
}
