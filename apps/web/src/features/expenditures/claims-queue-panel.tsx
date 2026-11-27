"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useCan } from "@/features/shell/use-can";
import { formatDate, rupeesExact } from "@/lib/format";
import type { ActionConfig } from "@/lib/api-client";
import { ClaimDecisionDialog, type ClaimDecision } from "./claim-decision-dialog";
import { ClaimReceiptDialog } from "./claim-receipt-dialog";
import type { ExpenseClaim } from "./expense-claims-api";
import { useClaimsQueue } from "./use-claims-queue";

/** Approvals surfaced on top of the Expenditure page: field claims awaiting review.
 *  Hidden entirely when the user can't approve or there's nothing pending. */
export function ClaimsQueuePanel({ actionConfig }: { readonly actionConfig: ActionConfig }) {
  const canApprove = useCan("action:expenditures.claims.approve");
  const { claims, isLoading, approve, reject } = useClaimsQueue(actionConfig);
  const [decision, setDecision] = useState<ClaimDecision | null>(null);
  const [receipt, setReceipt] = useState<ExpenseClaim | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!canApprove || isLoading || claims.length === 0) return null;

  async function approveFull(claim: ExpenseClaim) {
    setBusyId(claim.id);
    setError(null);
    try {
      await approve(claim.id, null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not approve the claim.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50/60 p-4">
      <h2 className="mb-3 text-sm font-semibold text-amber-900">
        Pending claims ({claims.length})
      </h2>
      {error ? (
        <p className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      ) : null}
      <ul className="space-y-2">
        {claims.map((claim) => (
          <li key={claim.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{claim.categoryName} · {rupeesExact(claim.claimedAmount)}</p>
              <p className="truncate text-xs text-muted-foreground">
                {claim.submitterName ?? "—"} · {formatDate(claim.date)}{claim.remarks ? ` · ${claim.remarks}` : ""}
              </p>
            </div>
            {claim.hasReceipt ? (
              <Button variant="outline" size="sm" onClick={() => setReceipt(claim)}>Receipt</Button>
            ) : null}
            <Button size="sm" disabled={busyId === claim.id} onClick={() => void approveFull(claim)}>Approve</Button>
            <Button variant="outline" size="sm" onClick={() => setDecision({ claim, mode: "reduce" })}>Reduce</Button>
            <Button variant="outline" size="sm" className="text-destructive" onClick={() => setDecision({ claim, mode: "reject" })}>Reject</Button>
          </li>
        ))}
      </ul>

      <ClaimReceiptDialog claim={receipt} onClose={() => setReceipt(null)} actionConfig={actionConfig} />
      <ClaimDecisionDialog
        decision={decision}
        onOpenChange={(open) => !open && setDecision(null)}
        onApprove={approve}
        onReject={reject}
      />
    </section>
  );
}
