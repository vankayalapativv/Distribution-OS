"use client";

import { DatePicker } from "./expenditure-date-picker";
import { toDate } from "./date-picker-utils";

/**
 * From–to period filter used by the Expenditure page. Two independent single-date
 * pickers rather than a range calendar — react-day-picker's range mode makes a
 * fresh two-click selection awkward (a click on an existing range just extends it),
 * so we use the reliable single picker twice. Each field constrains the other: the
 * "to" field can't go before "from", and "from" can't go after "to".
 */
export function DateRangePicker({
  from,
  to,
  onChange,
}: Readonly<{
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}>) {
  const fromDate = toDate(from);
  const toDateValue = toDate(to);

  return (
    <div className="flex items-center gap-2">
      <DatePicker
        value={from}
        onChange={(v) => onChange(v, to)}
        placeholder="From"
        maxDate={toDateValue}
        triggerClassName="w-[140px]"
      />
      <span className="text-sm text-muted-foreground">–</span>
      <DatePicker
        value={to}
        onChange={(v) => onChange(from, v)}
        placeholder="To"
        minDate={fromDate}
        triggerClassName="w-[140px]"
      />
    </div>
  );
}
