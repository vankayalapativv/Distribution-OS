"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { rupeesExact } from "@/lib/format";
import type { Advance, RecoveryPlanInput } from "./advances-api";
import { RecoveryPlanFields, toRecoveryPlan } from "./recovery-plan-fields";

export interface AdvanceDecision {
  advance: Advance;
  mode: "approve" | "reject";
}

/** Approve a requested advance (with a recovery plan) or reject it (with a reason). */
export function AdvanceDecisionDialog({
  decision,
  onOpenChange,
  onApprove,
  onReject,
}: {
  readonly decision: AdvanceDecision | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onApprove: (id: string, plan: RecoveryPlanInput) => Promise<void>;
  readonly onReject: (id: string, reason: string) => Promise<void>;
}) {
  const [plan, setPlan] = useState("full_next");
  const [installment, setInstallment] = useState("");
  const [reason, setReason] = useState("");

  const [prev, setPrev] = useState<AdvanceDecision | null>(null);
  if (decision !== prev) {
    setPrev(decision);
    setPlan("full_next");
    setInstallment("");
    setReason("");
  }

  if (!decision) return null;
  const { advance, mode } = decision;
  const isReject = mode === "reject";
  const built = toRecoveryPlan(plan, installment, advance.amount);
  const reasonValid = reason.trim().length > 0;

  async function onConfirm() {
    if (isReject) await onReject(advance.id, reason.trim());
    else if (built) await onApprove(advance.id, built);
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      destructive={isReject}
      title={isReject ? "Reject advance" : "Approve advance"}
      description={`${advance.userName ?? "Employee"} · ${rupeesExact(advance.amount)}${advance.reason ? ` · ${advance.reason}` : ""}`}
      confirmLabel={isReject ? "Reject" : "Approve"}
      confirmDisabled={isReject ? !reasonValid : built === null}
      extra={
        isReject ? (
          <div className="space-y-1.5">
            <Label htmlFor="adv-reason">Reason</Label>
            <Textarea id="adv-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. above the advance limit" />
          </div>
        ) : (
          <RecoveryPlanFields plan={plan} setPlan={setPlan} installment={installment} setInstallment={setInstallment} />
        )
      }
      onConfirm={onConfirm}
    />
  );
}
