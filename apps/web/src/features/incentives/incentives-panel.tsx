"use client";

/**
 * Incentives page: per sales-executive monthly incentives, in two sections —
 * Collections (verified collections × %) and Targets (a litre-threshold reward
 * + a per-litre rate). Month navigator; SA / Manager / Accountant enter the
 * %/rates/targets via a per-SE dialog. Display only (no payout tracking).
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { addMonths, format, startOfMonth, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { withQueryClient } from "@/components/data-table/query-provider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiGet, type ActionConfig } from "@/lib/api-client";
import { litres as fmtLitres, rupees } from "@/lib/format";
import { IncentiveEditDialog } from "./incentive-edit-dialog";
import type { IncentiveRow, IncentivesResponse } from "./incentives-api";

function pct(n: number | null): string {
  return n == null ? "—" : `${n}%`;
}

function SummaryCard({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="rounded-xl border border-border bg-white px-5 py-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

function IncentivesPanelInner({ actionConfig }: { readonly actionConfig: ActionConfig }) {
  const [selectedMonth, setSelectedMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [editing, setEditing] = useState<IncentiveRow | null>(null);

  const monthStr = format(selectedMonth, "yyyy-MM");
  const label = format(selectedMonth, "MMMM yyyy");
  const isCurrent = startOfMonth(new Date()).getTime() === selectedMonth.getTime();

  const query = useQuery({
    queryKey: ["incentives", monthStr],
    queryFn: () => apiGet<IncentivesResponse>(actionConfig, `/incentives?month=${monthStr}`),
    refetchInterval: 120_000,
  });
  const executives = query.data?.executives ?? [];

  const totalCollections = executives.reduce((s, e) => s + e.collectionsIncentive, 0);
  const totalTargets = executives.reduce((s, e) => s + e.targetIncentive + e.perLitreIncentive, 0);
  const grand = totalCollections + totalTargets;

  return (
    <div className="flex flex-col gap-6">
      {/* Month navigator */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="size-8" onClick={() => setSelectedMonth((d) => subMonths(d, 1))} aria-label="Previous month">
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-[9rem] text-center text-sm font-semibold text-foreground">{label}</span>
          <Button variant="outline" size="icon" className="size-8" onClick={() => setSelectedMonth((d) => addMonths(d, 1))} aria-label="Next month">
            <ChevronRight className="size-4" />
          </Button>
          {isCurrent ? (
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Current</span>
          ) : (
            <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => setSelectedMonth(startOfMonth(new Date()))}>
              This month
            </button>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard label="Collection incentive" value={rupees(totalCollections)} />
        <SummaryCard label="Target incentive" value={rupees(totalTargets)} />
        <SummaryCard label="Total payout" value={rupees(grand)} />
      </div>

      {(() => { if (query.isLoading) return (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ); if (query.isError) return (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Couldn&apos;t load incentives.{" "}
          <button type="button" className="font-medium text-primary underline" onClick={() => void query.refetch()}>
            Try again
          </button>
        </p>
      ); if (executives.length === 0) return (
        <p className="py-10 text-center text-sm text-muted-foreground">No active sales executives.</p>
      ); return (
        <>
          {/* Collections section */}
          <section className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
            <div className="border-b border-border px-5 py-3">
              <h2 className="text-sm font-semibold text-foreground">Collection incentive</h2>
              <p className="text-xs text-muted-foreground">Verified collections this month × the executive&apos;s %.</p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead>Executive</TableHead>
                    <TableHead className="text-right">Verified collections</TableHead>
                    <TableHead className="text-right">%</TableHead>
                    <TableHead className="text-right">Incentive</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {executives.map((e) => (
                    <TableRow key={e.userId} className="cursor-pointer" onClick={() => setEditing(e)}>
                      <TableCell className="font-medium text-foreground">{e.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{rupees(e.collectionsTotal)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{pct(e.collectionPct)}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{rupees(e.collectionsIncentive)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>

          {/* Targets section */}
          <section className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
            <div className="border-b border-border px-5 py-3">
              <h2 className="text-sm font-semibold text-foreground">Target incentive</h2>
              <p className="text-xs text-muted-foreground">
                A monthly litre target (reward if met) plus a per-litre rate on oil litres sold.
              </p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead>Executive</TableHead>
                    <TableHead className="text-right">Litres sold</TableHead>
                    <TableHead className="text-right">Monthly target</TableHead>
                    <TableHead className="text-right">Target reward</TableHead>
                    <TableHead className="text-right">Per-litre rate</TableHead>
                    <TableHead className="text-right">Per-litre incentive</TableHead>
                    <TableHead className="text-right">Target payout</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {executives.map((e) => (
                    <TableRow key={e.userId} className="cursor-pointer" onClick={() => setEditing(e)}>
                      <TableCell className="font-medium text-foreground">{e.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtLitres(e.litresTotal)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {e.targetLitres == null ? "—" : fmtLitres(e.targetLitres)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {e.targetReward == null ? "—" : rupees(e.targetReward)}
                        {e.targetLitres != null && (
                          <span
                            className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                              e.targetMet ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {e.targetMet ? "Met" : "Not met"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {e.perLitreRate == null ? "—" : `₹${e.perLitreRate}`}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{rupees(e.perLitreIncentive)}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {rupees(e.targetIncentive + e.perLitreIncentive)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>

          <p className="text-xs text-muted-foreground">Tip: click a row to set that executive&apos;s % / rate / target for {label}.</p>
        </>
      ); })()}

      {editing ? (
        <IncentiveEditDialog
          actionConfig={actionConfig}
          executive={editing}
          month={monthStr}
          label={label}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}

export const IncentivesPanel = withQueryClient(IncentivesPanelInner);
