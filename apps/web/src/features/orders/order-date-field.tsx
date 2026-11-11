"use client";

import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Label } from "@/components/ui/label";
import { LazyCalendar } from "@/components/ui/lazy-calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface OrderDateFieldProps {
  readonly value: Date | undefined;
  readonly onChange: (value: Date | undefined) => void;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

/** Local Date at midnight of today in IST (the business timezone), so the picker
 *  greys out future days regardless of the viewer's own timezone. */
function istTodayDate(): Date {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  return new Date(`${ymd}T00:00:00`);
}

/** The Order-Date picker (New + Edit order) — labelled popover calendar, defaults
 *  to Today. Office users may back-date but not future-date, so every day after
 *  today (IST) is disabled/greyed; the create+edit APIs enforce the same rule. */
export function OrderDateField({ value, onChange, open, onOpenChange }: OrderDateFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Order Date
      </Label>
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-sm transition-colors hover:bg-accent focus:outline-none">
          <span className={value ? "text-foreground" : "text-muted-foreground"}>
            {value ? format(value, "dd MMM yyyy") : "Today"}
          </span>
          <CalendarIcon size={14} className="shrink-0 opacity-40" />
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <LazyCalendar
            mode="single"
            selected={value}
            disabled={{ after: istTodayDate() }}
            onSelect={(d) => {
              onChange(d);
              onOpenChange(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
