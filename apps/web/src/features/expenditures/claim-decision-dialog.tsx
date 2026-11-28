"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { rupeesExact } from "@/lib/format";
import { EXPENDITURE_PAYMENT_MODES } from "./expenditures-api";
import type { ExpenseClaim } from "./expense-claims-api";

export interface ClaimDecision {
  claim: ExpenseClaim;
  mode: "approve" | "reject";
}

/** Approve + reimburse a claim (at the claimed amount, or a reduced one) picking
 *  the payment mode, or reject it with a reason. Approval reimburses in one step.
 *  Wraps ConfirmDialog so the busy/inline-error/close-on-success flow is shared. */
export function ClaimDecisionDialog({
  decision,
  onOpenChange,
  onApprove,
  onReject,
}: {
  readonly decision: ClaimDecision | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onApprove: (id: string, amount: number, paymentMode: string) => Promise<void>;
  readonly onReject: (id: string, reason: string) => Promise<void>;
}) {
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState("cash");
  const [reason, setReason] = useState("");

  // Seed/reset the fields whenever the target changes (render-time adjust-on-change).
  // Starts at null so the first open seeds the amount from the claim.
  const [prev, setPrev] = useState<ClaimDecision | null>(null);
  if (decision !== prev) {
    setPrev(decision);
    setAmount(decision ? String(decision.claim.claimedAmount) : "");
    setMode("cash");
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
    else await onApprove(claimId, amountNum, mode);
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      title={isReject ? "Reject claim" : "Approve & reimburse"}
      description={`${decision.claim.categoryName} · claimed ${rupeesExact(claimed)}`}
      destructive={isReject}
      confirmLabel={isReject ? "Reject" : "Approve & pay"}
      confirmDisabled={isReject ? !reasonValid : !amountValid}
      extra={
        isReject ? (
          <div className="space-y-1.5">
            <Label htmlFor="claim-reason">Reason (the submitter will see this)</Label>
            <Textarea id="claim-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. receipt is unreadable" />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="claim-amount">Approved amount (₹)</Label>
              <Input id="claim-amount" type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <p className="text-xs text-muted-foreground">Up to the claimed {rupeesExact(claimed)} — lower it to approve a reduced amount.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="claim-mode">Reimburse via</Label>
              <select
                id="claim-mode"
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                {EXPENDITURE_PAYMENT_MODES.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">Approving pays the employee now and records it on the entry.</p>
            </div>
          </div>
        )
      }
      onConfirm={onConfirm}
    />
  );
}
