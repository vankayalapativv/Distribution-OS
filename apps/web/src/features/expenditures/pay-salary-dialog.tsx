"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Label } from "@/components/ui/label";
import { rupeesExact } from "@/lib/format";
import { EXPENDITURE_PAYMENT_MODES } from "./expenditures-api";
import type { SalaryRow } from "./salary-api";

const SELECT_CLASS = "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm";

/** The first of the current month (period a salary is paid for). */
function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/** Pay a person's salary for this month — nets their advance recovery server-side. */
export function PaySalaryDialog({
  row,
  onOpenChange,
  onPay,
}: {
  readonly row: SalaryRow | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onPay: (userId: string, periodMonth: string, paymentMode: string) => Promise<void>;
}) {
  const [mode, setMode] = useState("bank_transfer");

  const [prev, setPrev] = useState<SalaryRow | null>(null);
  if (row !== prev) {
    setPrev(row);
    setMode("bank_transfer");
  }

  if (!row) return null;
  const { userId, userName, salary, advanceOutstanding } = row;

  async function onConfirm() {
    await onPay(userId, currentPeriod(), mode);
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      destructive={false}
      title="Pay salary"
      description={`${userName ?? "Employee"} · gross ${salary != null ? rupeesExact(salary) : "—"}${advanceOutstanding > 0 ? ` · up to ${rupeesExact(advanceOutstanding)} advance recovered` : ""}`}
      confirmLabel="Pay salary"
      extra={
        <div className="space-y-1.5">
          <Label htmlFor="pay-mode">Paid via</Label>
          <select id="pay-mode" value={mode} onChange={(e) => setMode(e.target.value)} className={SELECT_CLASS}>
            {EXPENDITURE_PAYMENT_MODES.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
      }
      onConfirm={onConfirm}
    />
  );
}
