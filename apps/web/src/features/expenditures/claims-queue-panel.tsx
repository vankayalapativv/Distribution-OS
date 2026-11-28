"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatDate, rupeesExact } from "@/lib/format";
import type { ActionConfig } from "@/lib/api-client";
import { ClaimDecisionDialog, type ClaimDecision } from "./claim-decision-dialog";
import { ClaimReceiptDialog } from "./claim-receipt-dialog";
import { PanelRowsSkeleton } from "./panel-skeleton";
import type { ExpenseClaim } from "./expense-claims-api";
import { useClaimsQueue } from "./use-claims-queue";

/** Body of the Claims dialog: field claims awaiting review (approve / reduce /
 *  reject). Shimmers while loading; shows an all-clear note when nothing pends.
 *  Permission gating lives on the kebab item that opens this. */
export function ClaimsQueuePanel({ actionConfig }: { readonly actionConfig: ActionConfig }) {
  const { claims, isLoading, approve, reject } = useClaimsQueue(actionConfig);
  const [decision, setDecision] = useState<ClaimDecision | null>(null);
  const [receipt, setReceipt] = useState<ExpenseClaim | null>(null);

  if (isLoading) return <PanelRowsSkeleton />;

  return (
    <div>
      {claims.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">No claims awaiting approval.</p>
      ) : (
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
              <Button size="sm" onClick={() => setDecision({ claim, mode: "approve" })}>Approve</Button>
              <Button variant="outline" size="sm" className="text-destructive" onClick={() => setDecision({ claim, mode: "reject" })}>Reject</Button>
            </li>
          ))}
        </ul>
      )}

      <ClaimReceiptDialog claim={receipt} onClose={() => setReceipt(null)} actionConfig={actionConfig} />
      <ClaimDecisionDialog
        decision={decision}
        onOpenChange={(open) => !open && setDecision(null)}
        onApprove={approve}
        onReject={reject}
      />
    </div>
  );
}
