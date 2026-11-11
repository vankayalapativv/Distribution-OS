"use client";

import { useState } from "react";
import { Check, ListFilter } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { FULFILLMENT_FILTER_OPTIONS } from "./order-fulfillment-options";

/**
 * The Fulfillment column header: the label (still click-to-sort via DataTable)
 * plus a filter dropdown. The trigger stops propagation so opening the filter
 * doesn't also toggle the sort. Selecting applies immediately (server-side).
 */
export function FulfillmentHeaderFilter({
  value,
  onChange,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = value !== "";
  return (
    <span className="inline-flex items-center gap-1">
      Fulfillment
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          onClick={(e) => e.stopPropagation()}
          aria-label="Filter fulfillment"
          className={cn(
            "rounded p-0.5 transition-colors hover:bg-muted",
            active ? "text-primary" : "text-muted-foreground/60",
          )}
        >
          <ListFilter size={13} />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-48 p-1" onClick={(e) => e.stopPropagation()}>
          {FULFILLMENT_FILTER_OPTIONS.map((o) => (
            <button
              key={o.value || "all"}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange(o.value);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm font-normal normal-case tracking-normal hover:bg-accent",
                value === o.value ? "font-semibold text-primary" : "text-foreground",
              )}
            >
              {o.label}
              {value === o.value ? <Check size={14} /> : null}
            </button>
          ))}
        </PopoverContent>
      </Popover>
    </span>
  );
}
