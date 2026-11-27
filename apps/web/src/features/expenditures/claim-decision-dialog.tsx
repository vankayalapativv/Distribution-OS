"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { rupeesExact } from "@/lib/format";
import type { ExpenseClaim } from "./expense-claims-api";

export interface ClaimDecision {
  claim: ExpenseClaim;
  mode: "reduce" | "reject";
}

/** Approve (optionally at a reduced amount) or reject a claim, with validation.
 *  Wraps ConfirmDialog so the busy/inline-error/close-on-success flow is shared. */
export function ClaimDecisionDialog({
  decision,
  onOpenChange,
  onApprove,
  onReject,
}: {
  readonly decision: ClaimDecision | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onApprove: (id: string, amount: number) => Promise<void>;
  readonly onReject: (id: string, reason: string) => Promise<void>;
}) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  // Seed/reset the fields whenever the target changes (render-time adjust-on-change).
  // Starts at null so the first open seeds the amount from the claim.
  const [prev, setPrev] = useState<ClaimDecision | null>(null);
  if (decision !== prev) {
    setPrev(decision);
    setAmount(decision ? String(decision.claim.claimedAmount) : "");
    setReason("");
  }

  if (!decision) return null; // closed — nothing to render (fields reset above)

  const { id: claimId, claimedAmount: claimed } = decision.claim;
  const isReject = decision.mode === "reject";
  const amountNum = Number(amount);
  const amountValid = amountNum > 0 && amountNum <= claimed;
  const reasonValid = reason.trim().length > 0;

  async function onConfirm() {
    if (isReject) await onReject(claimId, reason.trim());
    else await onApprove(claimId, amountNum);
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      title={isReject ? "Reject claim" : "Approve claim"}
      description={`${decision.claim.categoryName} · claimed ${rupeesExact(claimed)}`}
      destructive={isReject}
      confirmLabel={isReject ? "Reject" : "Approve"}
      confirmDisabled={isReject ? !reasonValid : !amountValid}
      extra={
        isReject ? (
          <div className="space-y-1.5">
            <Label htmlFor="claim-reason">Reason (the submitter will see this)</Label>
            <Textarea id="claim-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. receipt is unreadable" />
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="claim-amount">Approved amount (₹)</Label>
            <Input id="claim-amount" type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <p className="text-xs text-muted-foreground">Up to the claimed {rupeesExact(claimed)} — lower it to approve a reduced amount.</p>
          </div>
        )
      }
      onConfirm={onConfirm}
    />
  );
}
