"use client";

import { useState } from "react";
import { MoreVertical, Upload } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** Header ⋮ overflow menu for the Products catalogue — holds the secondary
 *  "Bulk Import" action; the primary "+ Add product" stays a visible button. */
export function ProductsHeaderMenu({ onImport }: Readonly<{ onImport: () => void }>) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        title="More actions"
        aria-label="More actions"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <MoreVertical className="size-4" />
      </PopoverTrigger>
      <PopoverContent align="end" side="bottom" className="w-44 p-1.5">
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-accent"
          onClick={() => {
            setOpen(false);
            onImport();
          }}
        >
          <Upload className="size-4" /> Bulk Import
        </button>
      </PopoverContent>
    </Popover>
  );
}
