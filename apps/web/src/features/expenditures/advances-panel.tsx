"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useCan } from "@/features/shell/use-can";
import { formatDate, rupeesExact } from "@/lib/format";
import type { ActionConfig } from "@/lib/api-client";
import { AdvanceDecisionDialog, type AdvanceDecision } from "./advance-decision-dialog";
import { RecordAdvanceDialog } from "./record-advance-dialog";
import { useAdvances } from "./use-advances";
import { useExpenditureLookups } from "./use-expenditure-lookups";

/** Advances on the Expenditure page: approve/reject SE requests, record a direct
 *  advance, and see who still owes an advance. Hidden when the user has neither
 *  advance permission and there's nothing to show. */
export function AdvancesPanel({ actionConfig }: { readonly actionConfig: ActionConfig }) {
  const canManage = useCan("action:expenditures.advances.manage");
  const canApprove = useCan("action:expenditures.advances.approve");
  const { requests, balances, outstandingTotal, isLoading, approve, reject, record } = useAdvances(actionConfig);
  const { people } = useExpenditureLookups(actionConfig);
  const [decision, setDecision] = useState<AdvanceDecision | null>(null);
  const [recording, setRecording] = useState(false);

  const visibleRequests = canApprove ? requests : [];
  if (isLoading) return null;
  if (!canManage && visibleRequests.length === 0 && balances.length === 0) return null;

  return (
    <section className="rounded-lg border border-violet-200 bg-violet-50/60 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-violet-900">
          Advances{balances.length > 0 ? ` — ${rupeesExact(outstandingTotal)} outstanding across ${balances.length}` : ""}
        </h2>
        {canManage ? <Button size="sm" onClick={() => setRecording(true)}>Record advance</Button> : null}
      </div>

      {visibleRequests.length > 0 ? (
        <ul className="space-y-2">
          {visibleRequests.map((advance) => (
            <li key={advance.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{advance.userName ?? "—"} · {rupeesExact(advance.amount)} <span className="rounded-full bg-amber-100 px-1.5 text-[11px] font-semibold text-amber-800">request</span></p>
                <p className="truncate text-xs text-muted-foreground">{advance.reason ?? "no reason given"} · {formatDate(advance.createdAt)}</p>
              </div>
              <Button size="sm" onClick={() => setDecision({ advance, mode: "approve" })}>Approve</Button>
              <Button size="sm" variant="outline" className="text-destructive" onClick={() => setDecision({ advance, mode: "reject" })}>Reject</Button>
            </li>
          ))}
        </ul>
      ) : null}

      {balances.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {balances.map((b, i) => (
            <li key={i} className="flex justify-between px-1 text-xs text-muted-foreground">
              <span>{b.userName ?? "—"}</span>
              <span className="font-medium text-foreground">{rupeesExact(b.outstanding)} outstanding</span>
            </li>
          ))}
        </ul>
      ) : null}

      <AdvanceDecisionDialog decision={decision} onOpenChange={(open) => !open && setDecision(null)} onApprove={approve} onReject={reject} />
      <RecordAdvanceDialog open={recording} people={people} onOpenChange={(open) => !open && setRecording(false)} onRecord={record} />
    </section>
  );
}
