"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";

// Shimmer placeholder shown while a search is in flight: five two-line rows
// (name bar + meta bar) that mirror a result row, with slightly varied widths
// so the block reads as loading content rather than a solid gray slab.
const SKELETON_WIDTHS: ReadonlyArray<readonly [string, string]> = [
  ["w-2/5", "w-3/5"],
  ["w-1/2", "w-3/4"],
  ["w-3/5", "w-2/3"],
  ["w-2/5", "w-3/5"],
  ["w-1/2", "w-3/4"],
];

function SearchComboboxSkeleton() {
  return (
    <div aria-hidden>
      {SKELETON_WIDTHS.map(([name, meta], i) => (
        <div key={i} className="flex flex-col gap-1.5 px-3 py-2">
          <Skeleton className={cn("h-3.5", name)} />
          <Skeleton className={cn("h-3", meta)} />
        </div>
      ))}
    </div>
  );
}

interface SearchComboboxProps<T> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerLabel: ReactNode;
  /** Extra classes for the trigger (e.g. a different height). */
  triggerClassName?: string;
  contentClassName: string;
  registerSearchInput: (el: HTMLInputElement | null) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  searchClassName: string;
  items: T[];
  getKey: (item: T) => string;
  isSelected: (item: T) => boolean;
  onSelect: (item: T) => void;
  renderItem: (item: T) => ReactNode;
  itemClassName: string;
  emptyText: string;
  disabled?: boolean;
  /** While true, the list is replaced by a shimmer placeholder (server search in
   *  flight). Overrides both the items and the empty state. */
  loading?: boolean;
}

/**
 * The canonical searchable popover combobox: a trigger + a Popover panel holding
 * a search box and a flush option list. Portalled via Popover so the panel is
 * never clipped by a dialog's `overflow`. Higher-level pickers (`SearchSelect`,
 * `CustomerSearchSelect`, the order oil-line combobox) are built on top of it.
 */
export function SearchCombobox<T>({
  open,
  onOpenChange,
  triggerLabel,
  triggerClassName,
  contentClassName,
  registerSearchInput,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  searchClassName,
  items,
  getKey,
  isSelected,
  onSelect,
  renderItem,
  itemClassName,
  emptyText,
  disabled,
  loading,
}: Readonly<SearchComboboxProps<T>>) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        disabled={disabled}
        className={cn(
          "flex h-8 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm transition-colors hover:bg-accent focus:outline-none disabled:pointer-events-none disabled:opacity-50",
          triggerClassName,
        )}
      >
        {triggerLabel}
      </PopoverTrigger>
      <PopoverContent className={contentClassName} align="start">
        <div className="border-b border-border p-2">
          <Input
            ref={registerSearchInput}
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className={searchClassName}
          />
        </div>
        <div className="max-h-[220px] overflow-y-auto py-1">
          {(() => { if (loading) return (
            <SearchComboboxSkeleton />
          ); if (items.length === 0) return (
            <p className="px-3 py-5 text-center text-sm text-muted-foreground">{emptyText}</p>
          ); return (
            items.map((item) => (
              <button
                key={getKey(item)}
                type="button"
                onClick={() => onSelect(item)}
                className={`${itemClassName} ${
                  isSelected(item) ? "bg-primary/10 text-primary font-medium" : "text-foreground"
                }`}
              >
                {renderItem(item)}
              </button>
            ))
          ); })()}
        </div>
      </PopoverContent>
    </Popover>
  );
}
