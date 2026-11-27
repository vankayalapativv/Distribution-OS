"use client";

import { useState } from "react";
import { Eye, MoreVertical, Pencil, Trash2, Undo2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { Expenditure } from "./expenditures-api";

const itemClass =
  "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-accent disabled:pointer-events-none disabled:opacity-40";

/** Single ⋮ kebab per expenditure row → View bill (when the entry has one), Edit,
 *  Delete. Matches the invoice/order/product row menus. The row is clickable, so
 *  the wrapper stops propagation to avoid also opening the row. */
export function ExpenditureRowActions({
  entry,
  onEdit,
  onDelete,
  onViewBill,
  onVoid,
}: {
  readonly entry: Expenditure;
  readonly onEdit: (entry: Expenditure) => void;
  readonly onDelete: (entry: Expenditure) => void;
  readonly onViewBill: (entry: Expenditure) => void;
  /** Reverse the booked entry (audited). Shown only when the caller may void. */
  readonly onVoid?: (entry: Expenditure) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex justify-end" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          title="Actions"
          aria-label={`Actions for ${entry.expenditureCode}`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <MoreVertical className="size-4" />
        </PopoverTrigger>
        <PopoverContent align="end" side="bottom" className="w-40 gap-0.5 p-1.5">
          {entry.hasBill && (
            <button
              type="button"
              aria-label={`View bill for ${entry.expenditureCode}`}
              className={cn(itemClass, "text-foreground")}
              onClick={() => { setOpen(false); onViewBill(entry); }}
            >
              <Eye className="size-4" /> View bill
            </button>
          )}
          <button
            type="button"
            aria-label={`Edit ${entry.expenditureCode}`}
            className={cn(itemClass, "text-foreground")}
            onClick={() => { setOpen(false); onEdit(entry); }}
          >
            <Pencil className="size-4" /> Edit
          </button>
          {onVoid && (
            <button
              type="button"
              aria-label={`Reverse ${entry.expenditureCode}`}
              className={cn(itemClass, "text-foreground")}
              onClick={() => { setOpen(false); onVoid(entry); }}
            >
              <Undo2 className="size-4" /> Reverse
            </button>
          )}
          <button
            type="button"
            aria-label={`Delete ${entry.expenditureCode}`}
            className={cn(itemClass, "text-destructive")}
            onClick={() => { setOpen(false); onDelete(entry); }}
          >
            <Trash2 className="size-4" /> Delete
          </button>
        </PopoverContent>
      </Popover>
    </div>
  );
}
