"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Label } from "@/components/ui/label";
import { rupeesExact } from "@/lib/format";
import { EXPENDITURE_PAYMENT_MODES } from "./expenditures-api";
import type { ReimbursementPayable } from "./reimbursements-api";

/** Record how an owed reimbursement was settled (cash/UPI/bank…), then mark paid. */
export function SettleDialog({
  payable,
  onOpenChange,
  onPay,
}: {
  readonly payable: ReimbursementPayable | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onPay: (id: string, paymentMode: string) => Promise<void>;
}) {
  const [mode, setMode] = useState("cash");

  // Reset the mode whenever the target changes (render-time adjust-on-change).
  const [prev, setPrev] = useState<ReimbursementPayable | null>(null);
  if (payable !== prev) {
    setPrev(payable);
    setMode("cash");
  }

  if (!payable) return null;
  const { id, userName, amount } = payable;

  return (
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      destructive={false}
      title="Mark reimbursement paid"
      description={`Pay ${userName ?? "the employee"} ${rupeesExact(amount)}`}
      confirmLabel="Mark paid"
      extra={
        <div className="space-y-1.5">
          <Label htmlFor="pay-mode">Paid via</Label>
          <select
            id="pay-mode"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          >
            {EXPENDITURE_PAYMENT_MODES.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
      }
      onConfirm={() => onPay(id, mode)}
    />
  );
}
