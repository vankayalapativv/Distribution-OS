"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useCan } from "@/features/shell/use-can";
import { rupeesExact } from "@/lib/format";
import type { ActionConfig } from "@/lib/api-client";
import { SetSalaryDialog } from "./set-salary-dialog";
import { PaySalaryDialog } from "./pay-salary-dialog";
import { VoidReasonDialog } from "./void-reason-dialog";
import type { SalaryRow } from "./salary-api";
import { useSalary } from "./use-salary";

/** Salary & pay on the Expenditure page: each person's salary, advance outstanding,
 *  and this month's pay status, with Set-salary + Pay. Sensitive — only shown to
 *  Super Admin (or a role granted salary.view). */
export function SalaryPanel({ actionConfig }: { readonly actionConfig: ActionConfig }) {
  const canView = useCan("action:salary.view");
  const canManage = useCan("action:salary.manage");
  const canVoid = useCan("action:expenditures.void");
  const { rows, staff, isLoading, setSalary, paySalary, voidSalary } = useSalary(actionConfig);
  const [setting, setSetting] = useState(false);
  const [paying, setPaying] = useState<SalaryRow | null>(null);
  const [reversing, setReversing] = useState<{ name: string; paymentId: string } | null>(null);

  if (!canView || isLoading) return null;

  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">Salary &amp; pay</h2>
        {canManage ? <Button size="sm" onClick={() => setSetting(true)}>Set salary</Button> : null}
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No salaries set yet.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.userId} className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.userName ?? "—"} · {r.salary != null ? rupeesExact(r.salary) : "salary not set"}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {r.advanceOutstanding > 0 ? `${rupeesExact(r.advanceOutstanding)} advance outstanding · ` : ""}
                  {r.paidThisMonth ? "paid this month" : "not paid this month"}
                </p>
              </div>
              {canManage && r.salary != null && !r.paidThisMonth ? <Button size="sm" onClick={() => setPaying(r)}>Pay</Button> : null}
              {canManage && canVoid && r.paidThisMonth && r.paymentId ? (
                <Button size="sm" variant="outline" onClick={() => setReversing({ name: r.userName ?? "the employee", paymentId: r.paymentId! })}>Reverse</Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <SetSalaryDialog open={setting} staff={staff} onOpenChange={(open) => !open && setSetting(false)} onSave={setSalary} />
      <PaySalaryDialog row={paying} onOpenChange={(open) => !open && setPaying(null)} onPay={paySalary} />
      <VoidReasonDialog
        open={reversing != null}
        title="Reverse this salary run?"
        description={`This undoes ${reversing?.name ?? "the employee"}'s pay for this month and restores any advance it recovered. The month can then be re-run.`}
        confirmLabel="Reverse pay"
        onOpenChange={(open) => !open && setReversing(null)}
        onConfirm={async (reason) => { await voidSalary(reversing!.paymentId, reason); setReversing(null); }}
      />
    </section>
  );
}
