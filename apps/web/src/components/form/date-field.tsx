"use client";

import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { LazyCalendar } from "@/components/ui/lazy-calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** Local Date at midnight of today in IST, so "future" greys out regardless of
 *  the viewer's own timezone. */
export function istTodayDate(): Date {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  return new Date(`${ymd}T00:00:00`);
}

/** Today in IST as a `yyyy-mm-dd` string (the API's date format). */
export function istTodayYmd(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

/**
 * Popover calendar whose value is a `yyyy-mm-dd` string (the API's format).
 * Future days are disabled by default (office entries may back-date, not
 * future-date); pass `allowFuture` to lift that.
 */
export function DateField({
  value,
  onChange,
  placeholder = "Pick a date",
  allowFuture = false,
  className,
}: {
  readonly value: string;
  readonly onChange: (v: string) => void;
  readonly placeholder?: string;
  readonly allowFuture?: boolean;
  readonly className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? new Date(`${value}T00:00:00`) : undefined;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-sm transition-colors hover:border-primary focus:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40",
          className,
        )}
      >
        <span className={selected ? "text-foreground" : "text-muted-foreground"}>
          {selected ? format(selected, "dd MMM yyyy") : placeholder}
        </span>
        <CalendarIcon size={14} className="shrink-0 opacity-40" />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <LazyCalendar
          mode="single"
          selected={selected}
          disabled={allowFuture ? undefined : { after: istTodayDate() }}
          onSelect={(d) => {
            if (d) onChange(format(d, "yyyy-MM-dd"));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
