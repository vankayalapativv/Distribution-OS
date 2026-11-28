"use client";

import { useState } from "react";
import { formatDate, rupeesExact } from "@/lib/format";
import type { ActionConfig } from "@/lib/api-client";
import { PanelRowsSkeleton } from "./panel-skeleton";
import { useEmployeeLedger } from "./use-employee-ledger";
import { useExpenditureLookups } from "./use-expenditure-lookups";
import type { LedgerEntry } from "./employee-ledger-api";

function Chip({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

function amountTone(delta: number): string {
  if (delta > 0) return "text-emerald-600";
  if (delta < 0) return "text-destructive";
  return "text-muted-foreground";
}
function amountText(e: LedgerEntry): string {
  const sign = e.owedDelta > 0 ? "+" : e.owedDelta < 0 ? "−" : "";
  return `${sign}${rupeesExact(e.amount)}`;
}

/** Body of the Employee ledger dialog: pick a person, see their combined claims,
 *  advances, recoveries and (if permitted) salary with a running owed balance. */
export function EmployeeLedgerDialogBody({ actionConfig }: { readonly actionConfig: ActionConfig }) {
  const { people } = useExpenditureLookups(actionConfig);
  const [userId, setUserId] = useState("");
  const { ledger, isLoading } = useEmployeeLedger(actionConfig, userId || null);

  return (
    <div className="space-y-4">
      <label className="block text-sm">
        <span className="mb-1 block text-muted-foreground">Person</span>
        <select
          aria-label="Person"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
        >
          <option value="">Select a person…</option>
          {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>

      {!userId ? (
        <p className="py-4 text-center text-sm text-muted-foreground">Pick a person to see their statement.</p>
      ) : isLoading || !ledger ? (
        <PanelRowsSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Chip label="Owed to them" value={rupeesExact(ledger.summary.reimbursementOwed)} />
            <Chip label="Advance out" value={rupeesExact(ledger.summary.advanceOutstanding)} />
            {ledger.salaryIncluded ? <Chip label="Monthly salary" value={ledger.summary.monthlySalary != null ? rupeesExact(ledger.summary.monthlySalary) : "—"} /> : null}
            {ledger.salaryIncluded ? <Chip label="This month net" value={ledger.summary.thisMonthNet != null ? rupeesExact(ledger.summary.thisMonthNet) : "—"} /> : null}
          </div>

          {ledger.entries.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No expense activity yet.</p>
          ) : (
            <ul>
              {ledger.entries.map((e, i) => (
                <li key={i} className="flex items-center justify-between gap-2 border-b border-border py-1.5 text-sm last:border-0">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{e.label}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(e.at)}</p>
                  </div>
                  <div className="text-right">
                    <p className={amountTone(e.owedDelta)}>{amountText(e)}</p>
                    <p className="text-xs text-muted-foreground">bal {rupeesExact(e.balance)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
