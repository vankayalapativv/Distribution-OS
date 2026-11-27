"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Staff } from "./salary-api";

const SELECT_CLASS = "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm";

/** Set / change a person's monthly salary (effective from today). */
export function SetSalaryDialog({
  open,
  staff,
  onOpenChange,
  onSave,
}: {
  readonly open: boolean;
  readonly staff: Staff[];
  readonly onOpenChange: (open: boolean) => void;
  readonly onSave: (userId: string, amount: number, effectiveFrom: string | null) => Promise<void>;
}) {
  const [userId, setUserId] = useState("");
  const [amount, setAmount] = useState("");

  const [prev, setPrev] = useState(false);
  if (open !== prev) {
    setPrev(open);
    if (open) { setUserId(""); setAmount(""); }
  }

  if (!open) return null;
  const amountNum = Number(amount);
  const valid = Boolean(userId) && amountNum > 0;

  async function onConfirm() {
    if (userId && amountNum > 0) await onSave(userId, amountNum, null);
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      destructive={false}
      title="Set monthly salary"
      description="A raise is a new figure effective today; the latest one applies."
      confirmLabel="Save salary"
      confirmDisabled={!valid}
      extra={
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="sal-person">Person</Label>
            <select id="sal-person" value={userId} onChange={(e) => setUserId(e.target.value)} className={SELECT_CLASS}>
              <option value="">Select a person…</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sal-amount">Monthly salary (₹)</Label>
            <Input id="sal-amount" type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
        </div>
      }
      onConfirm={onConfirm}
    />
  );
}
