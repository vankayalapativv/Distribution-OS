"use client";

import { useState } from "react";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** Row handlers for the oil catalogue table. Stock lives on the
 *  dedicated Stock Journal page now, so these are just edit/delete. */
export interface CatalogueHandlers<T> {
  onEdit: (row: T) => void;
  onDelete: (row: T) => void;
  /** false for ACCOUNTANT — catalogue edit/delete hidden. */
  canManage: boolean;
}

const itemClass =
  "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-accent disabled:pointer-events-none disabled:opacity-40";

/** Single ⋮ kebab per catalogue row → Edit + Delete. Matches the invoice/order
 *  row menus. Stops row-click propagation so opening the menu never opens the row. */
export function RowActions<T>({
  row, onEdit, onDelete, label,
}: Readonly<{
  row: T;
  onEdit: (row: T) => void;
  onDelete: (row: T) => void;
  label: string;
}>) {
  const [open, setOpen] = useState(false);
  return (
    <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          title="Actions"
          aria-label={`${label} actions`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <MoreVertical className="size-4" />
        </PopoverTrigger>
        <PopoverContent align="end" side="bottom" className="w-40 gap-0.5 p-1.5">
          <button
            type="button"
            aria-label={`Edit ${label}`}
            className={cn(itemClass, "text-foreground")}
            onClick={() => { setOpen(false); onEdit(row); }}
          >
            <Pencil className="size-4" /> Edit
          </button>
          <button
            type="button"
            aria-label={`Delete ${label}`}
            className={cn(itemClass, "text-destructive")}
            onClick={() => { setOpen(false); onDelete(row); }}
          >
            <Trash2 className="size-4" /> Delete
          </button>
        </PopoverContent>
      </Popover>
    </div>
  );
}
