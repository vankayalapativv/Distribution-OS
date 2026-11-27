"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SELECT_CLASS = "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm";

/** How an advance is recovered from salary: the whole amount next payday, or a
 *  ₹/month installment. Shared by the approve + record dialogs. */
export function RecoveryPlanFields({
  plan,
  setPlan,
  installment,
  setInstallment,
}: {
  readonly plan: string;
  readonly setPlan: (v: string) => void;
  readonly installment: string;
  readonly setInstallment: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="rec-plan">Recover from salary</Label>
      <select id="rec-plan" value={plan} onChange={(e) => setPlan(e.target.value)} className={SELECT_CLASS}>
        <option value="full_next">Full amount, next salary</option>
        <option value="installment">In monthly installments</option>
      </select>
      {plan === "installment" ? (
        <div className="pt-1.5">
          <Label htmlFor="rec-inst">Installment (₹/month)</Label>
          <Input id="rec-inst" type="number" inputMode="numeric" value={installment} onChange={(e) => setInstallment(e.target.value)} />
        </div>
      ) : null}
    </div>
  );
}

/** Build a validated recovery-plan payload, or null when the installment is bad. */
export function toRecoveryPlan(plan: string, installment: string, amount: number):
  | { recoveryPlan: "full_next" | "installment"; installmentAmount: number | null }
  | null {
  if (plan !== "installment") return { recoveryPlan: "full_next", installmentAmount: null };
  const n = Number(installment);
  if (!(n > 0 && n <= amount)) return null;
  return { recoveryPlan: "installment", installmentAmount: n };
}
