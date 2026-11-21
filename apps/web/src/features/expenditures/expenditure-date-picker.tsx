"use client";

import { useState } from "react";
import { format } from "date-fns";
import type { Matcher } from "react-day-picker";
import { CalendarIcon } from "lucide-react";
import { LazyCalendar } from "@/components/ui/lazy-calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toDate, toValue, TRIGGER_CLASS } from "./date-picker-utils";

/** Single-date picker (shadcn Calendar behind a popover). */
export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  id,
  disableFuture = false,
  minDate,
  maxDate,
  triggerClassName = "w-full",
}: Readonly<{
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  /** Grey out days after today (e.g. a past-only report/tracking date). */
  disableFuture?: boolean;
  /** Grey out days before this one (e.g. a range's "to" can't precede its "from"). */
  minDate?: Date;
  /** Grey out days after this one (e.g. a range's "from" can't exceed its "to"). */
  maxDate?: Date;
  /** Override the trigger width/layout (defaults to full width for forms). */
  triggerClassName?: string;
}>) {
  const [open, setOpen] = useState(false);
  const selected = toDate(value);

  const disabled: Matcher[] = [];
  if (disableFuture) disabled.push({ after: new Date() });
  if (minDate) disabled.push({ before: minDate });
  if (maxDate) disabled.push({ after: maxDate });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger id={id} className={`${TRIGGER_CLASS} ${triggerClassName}`}>
        <span className={selected ? "text-foreground" : "text-muted-foreground"}>
          {selected ? format(selected, "dd MMM yyyy") : placeholder}
        </span>
        <CalendarIcon size={14} className="shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <LazyCalendar
          mode="single"
          selected={selected}
          defaultMonth={selected ?? minDate ?? maxDate}
          disabled={disabled.length > 0 ? disabled : undefined}
          onSelect={(d: Date | undefined) => {
            onChange(toValue(d));
            if (d) setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
