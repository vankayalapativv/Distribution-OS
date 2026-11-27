"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RecoveryPlanInput } from "./advances-api";
import { RecoveryPlanFields, toRecoveryPlan } from "./recovery-plan-fields";

const SELECT_CLASS = "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm";

/** Office records a direct advance (cash already handed over → active). */
export function RecordAdvanceDialog({
  open,
  people,
  onOpenChange,
  onRecord,
}: {
  readonly open: boolean;
  readonly people: { id: string; name: string }[];
  readonly onOpenChange: (open: boolean) => void;
  readonly onRecord: (input: { userId: string; amount: number; reason: string | null } & RecoveryPlanInput) => Promise<void>;
}) {
  const [userId, setUserId] = useState("");
  const [amount, setAmount] = useState("");
  const [plan, setPlan] = useState("full_next");
  const [installment, setInstallment] = useState("");

  const [prev, setPrev] = useState(false);
  if (open !== prev) {
    setPrev(open);
    if (open) { setUserId(""); setAmount(""); setPlan("full_next"); setInstallment(""); }
  }

  if (!open) return null;
  const amountNum = Number(amount);
  const built = toRecoveryPlan(plan, installment, amountNum);
  const valid = Boolean(userId) && amountNum > 0 && built !== null;

  async function onConfirm() {
    if (built && userId && amountNum > 0) {
      await onRecord({ userId, amount: amountNum, reason: null, ...built });
    }
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      destructive={false}
      title="Record an advance"
      description="Cash handed to a field person ahead of salary."
      confirmLabel="Record advance"
      confirmDisabled={!valid}
      extra={
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="adv-person">Person</Label>
            <select id="adv-person" value={userId} onChange={(e) => setUserId(e.target.value)} className={SELECT_CLASS}>
              <option value="">Select a person…</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adv-amount">Amount (₹)</Label>
            <Input id="adv-amount" type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <RecoveryPlanFields plan={plan} setPlan={setPlan} installment={installment} setInstallment={setInstallment} />
        </div>
      }
      onConfirm={onConfirm}
    />
  );
}
