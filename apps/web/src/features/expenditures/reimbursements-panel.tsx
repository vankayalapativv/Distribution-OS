"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useCan } from "@/features/shell/use-can";
import { formatDate, rupeesExact } from "@/lib/format";
import type { ActionConfig } from "@/lib/api-client";
import { SettleDialog } from "./settle-dialog";
import type { ReimbursementPayable } from "./reimbursements-api";
import { useReimbursements } from "./use-reimbursements";

/** "Reimbursements to pay" on the Expenditure page: approved claims the company
 *  still owes field staff. Hidden when the user can't pay or nothing is owed. */
export function ReimbursementsPanel({ actionConfig }: { readonly actionConfig: ActionConfig }) {
  const canPay = useCan("action:expenditures.reimbursements.pay");
  const { owed, total, peopleCount, isLoading, markPaid } = useReimbursements(actionConfig);
  const [settling, setSettling] = useState<ReimbursementPayable | null>(null);

  if (!canPay || isLoading || owed.length === 0) return null;

  return (
    <section className="rounded-lg border border-sky-200 bg-sky-50/60 p-4">
      <h2 className="mb-3 text-sm font-semibold text-sky-900">
        Reimbursements to pay — {rupeesExact(total)} to {peopleCount} {peopleCount === 1 ? "person" : "people"}
      </h2>
      <ul className="space-y-2">
        {owed.map((payable) => (
          <li key={payable.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{payable.userName ?? "—"} · {rupeesExact(payable.amount)}</p>
              <p className="truncate text-xs text-muted-foreground">{payable.categoryName} · {payable.code} · {formatDate(payable.date)}</p>
            </div>
            <Button size="sm" onClick={() => setSettling(payable)}>Mark paid</Button>
          </li>
        ))}
      </ul>

      <SettleDialog payable={settling} onOpenChange={(open) => !open && setSettling(null)} onPay={markPaid} />
    </section>
  );
}
