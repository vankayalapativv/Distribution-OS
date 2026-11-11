"use client";

import { useRef, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { apiGet, type ActionConfig } from "@/lib/api-client";
import { productivityColor } from "@/lib/productivity";
import {
  buildFeed,
  ISO,
  missedForPage,
  PAGE_SIZE,
  pageCountOf,
  presetRange,
  productivityPct,
  type PresetKey,
  type VisitsData,
} from "./customer-visits-logic";

/** State, query and derived feed/pagination for the customer Visits tab. */
export function useCustomerVisits(customerId: string, actionConfig: ActionConfig) {
  const [preset, setPreset] = useState<PresetKey>("all");
  const [range, setRange] = useState<{ from: string | null; to: string | null }>({ from: null, to: null });
  const [page, setPage] = useState(1);
  const [calOpen, setCalOpen] = useState(false);
  const phase = useRef<"start" | "end">("start");

  const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (range.from) qs.set("from", range.from);
  if (range.to) qs.set("to", range.to);
  const query = useQuery({
    queryKey: ["customer-visits", customerId, range.from, range.to, page],
    queryFn: () => apiGet<VisitsData>(actionConfig, `/customers/${customerId}/visits?${qs.toString()}`),
    placeholderData: keepPreviousData,
  });
  const data = query.data;
  const summary = data?.summary ?? { today: 0, week: 0, month: 0, all: 0 };

  const applyPreset = (k: PresetKey) => { setPreset(k); setRange(presetRange(k)); setPage(1); };
  const onCalendar = (sel: DateRange | undefined) => {
    if (!sel?.from) return;
    setPreset("custom");
    setRange({ from: format(sel.from, ISO), to: format(sel.to ?? sel.from, ISO) });
    setPage(1);
    if (phase.current === "start") phase.current = "end";
    else { phase.current = "start"; setCalOpen(false); }
  };
  const onCalOpenChange = (o: boolean) => { if (o) phase.current = "start"; setCalOpen(o); };

  const pageCount = pageCountOf(data?.total ?? 0);
  const pct = productivityPct(data);
  const pill = pct !== null ? productivityColor(pct) : null;
  const feed = buildFeed(data?.rows ?? [], missedForPage(data?.missedRows ?? [], pageCount, page));

  return {
    preset, range, page, setPage, calOpen, onCalOpenChange,
    query, data, summary, applyPreset, onCalendar, pageCount, pct, pill, feed,
  };
}
