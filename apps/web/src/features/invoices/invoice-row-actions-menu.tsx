"use client";

import { useState } from "react";
import Link from "next/link";
import { MoreVertical } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** Single ⋮ kebab per invoice row → dropdown with Download (every row) plus Edit
 *  + Cancel on editable invoices (generated, unpaid, not cancelled). Renders
 *  nothing when no action is wired. The server re-checks Edit/Cancel. */
export function InvoiceRowActionsMenu({
  onDownload,
  editHref,
  onCancel,
}: Readonly<{
  onDownload?: () => void;
  editHref?: string;
  onCancel?: () => void;
}>) {
  const [open, setOpen] = useState(false);
  if (!onDownload && !editHref && !onCancel) return null;
  const itemClass =
    "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-accent disabled:pointer-events-none disabled:opacity-40";
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
          {onDownload && (
            <button
              type="button"
              className={cn(itemClass, "text-foreground")}
              onClick={() => {
                setOpen(false);
                onDownload();
              }}
            >
              Download PDF
            </button>
          )}
          {editHref && (
            <Link href={editHref} className={cn(itemClass, "text-foreground")} onClick={() => setOpen(false)}>
              Edit
            </Link>
          )}
          {onCancel && (
            <button
              type="button"
              className={cn(itemClass, "text-destructive")}
              onClick={() => {
                setOpen(false);
                onCancel();
              }}
            >
              Cancel
            </button>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
