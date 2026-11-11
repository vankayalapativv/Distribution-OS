"use client";

import { useState } from "react";
import { MoreVertical, Pencil, ReceiptText, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** Single ⋮ kebab per row → dropdown with the row's actions (role-gated by the
 *  caller). Replaces the old row of separate Create-Invoice/Edit/Cancel icons. */
export function RowActionsMenu({
  canGenerate,
  canEdit,
  canManage,
  cancelled,
  fullyBilled,
  onGenerate,
  onEdit,
  onCancel,
}: {
  readonly canGenerate: boolean;
  /** Edit is only offered while the order is still un-invoiced (see the list). */
  readonly canEdit: boolean;
  readonly canManage: boolean;
  readonly cancelled: boolean;
  /** Fully invoiced → nothing left to cancel (server blocks it); disable Cancel. */
  readonly fullyBilled: boolean;
  readonly onGenerate: () => void;
  readonly onEdit: () => void;
  readonly onCancel: () => void;
}) {
  const [open, setOpen] = useState(false);
  const itemClass =
    "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-accent disabled:pointer-events-none disabled:opacity-40";
  const run = (fn: () => void) => {
    setOpen(false);
    fn();
  };
  return (
    <div className="flex justify-end" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          title="Actions"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <MoreVertical className="size-4" />
        </PopoverTrigger>
        <PopoverContent align="end" side="bottom" className="w-44 gap-0.5 p-1.5">
          {canGenerate && (
            <button type="button" className={cn(itemClass, "text-primary")} onClick={() => run(onGenerate)}>
              <ReceiptText className="size-4" /> Create Invoice
            </button>
          )}
          {canEdit && (
            <button type="button" className={cn(itemClass, "text-foreground")} onClick={() => run(onEdit)}>
              <Pencil className="size-4" /> Edit order
            </button>
          )}
          {canManage && (
            <button
              type="button"
              disabled={cancelled || fullyBilled}
              title={fullyBilled ? "Fully invoiced — nothing left to cancel" : undefined}
              className={cn(itemClass, "text-destructive")}
              onClick={() => run(onCancel)}
            >
              <Trash2 className="size-4" /> Cancel order
            </button>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
