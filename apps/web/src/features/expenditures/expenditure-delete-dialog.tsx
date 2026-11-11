"use client";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { formatDate, rupeesExact } from "@/lib/format";
import type { Expenditure } from "./expenditures-api";

function Row({ label, children }: { readonly label: string; readonly children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** Confirm-and-delete one expenditure (permanent, includes the attached bill). */
export function ExpenditureDeleteDialog({
  deleting,
  onOpenChange,
  onConfirm,
}: {
  readonly deleting: Expenditure | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onConfirm: () => Promise<void>;
}) {
  return (
    <ConfirmDialog
      open={deleting !== null}
      onOpenChange={(open) => !open && onOpenChange(false)}
      title="Delete expenditure?"
      description="This permanently removes the entry and its attached bill. It can't be undone."
      details={
        deleting ? (
          <dl className="space-y-1">
            <Row label="Entry"><span className="font-mono text-xs">{deleting.expenditureCode}</span></Row>
            <Row label="Category"><span className="font-medium">{deleting.categoryName}</span></Row>
            <Row label="Amount"><span className="font-semibold">{rupeesExact(deleting.amount)}</span></Row>
            <Row label="Date">{formatDate(deleting.expenditureDate)}</Row>
            {deleting.paidTo ? <Row label="Paid to">{deleting.paidTo}</Row> : null}
          </dl>
        ) : null
      }
      confirmLabel="Delete expenditure"
      onConfirm={onConfirm}
    />
  );
}
