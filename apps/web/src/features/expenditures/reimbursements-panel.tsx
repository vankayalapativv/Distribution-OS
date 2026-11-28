"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatDate, rupeesExact } from "@/lib/format";
import type { ActionConfig } from "@/lib/api-client";
import { SettleDialog } from "./settle-dialog";
import { PanelRowsSkeleton } from "./panel-skeleton";
import type { ReimbursementPayable } from "./reimbursements-api";
import { useReimbursements } from "./use-reimbursements";

/** Body of the Reimbursements dialog: approved claims the company still owes
 *  field staff, with mark-paid. Shimmer while loading, all-clear when nothing's
 *  owed. Permission gating lives on the kebab item. */
export function ReimbursementsPanel({ actionConfig }: { readonly actionConfig: ActionConfig }) {
  const { owed, total, peopleCount, isLoading, markPaid } = useReimbursements(actionConfig);
  const [settling, setSettling] = useState<ReimbursementPayable | null>(null);

  if (isLoading) return <PanelRowsSkeleton />;

  return (
    <div>
      {owed.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">Nothing owed to field staff right now.</p>
      ) : (
        <>
          <p className="mb-3 text-sm font-medium text-muted-foreground">
            {rupeesExact(total)} to {peopleCount} {peopleCount === 1 ? "person" : "people"}
          </p>
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
        </>
      )}

      <SettleDialog payable={settling} onOpenChange={(open) => !open && setSettling(null)} onPay={markPaid} />
    </div>
  );
}
