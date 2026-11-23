"use client";

import { type ReactNode, useState } from "react";
import { ReassignAvatar } from "./reassign-avatar";
import { ReassignMove } from "./reassign-move";
import { ReassignWhatMoves } from "./reassign-what-moves";
import { ReassignHistory } from "./reassign-history";
import { ReassignConfirmDialog } from "./reassign-confirm-dialog";
import { ReassignDetailSkeleton } from "./reassign-detail-skeleton";
import { totalCount } from "./reassign-logic";
import type { useReassign } from "./use-reassign";

type State = ReturnType<typeof useReassign>;

function Panel({ children, className = "" }: { readonly children: ReactNode; readonly className?: string }) {
  return <section className={`rounded-xl border border-border bg-card p-6 shadow-sm ${className}`}>{children}</section>;
}

/** The reassign detail for the selected customer: header, move block, what-moves,
 *  history + undo, and the extra-safe confirm dialog. */
export function ReassignDetail({ state, selected }: { readonly state: State; readonly selected: boolean }) {
  const { preview, loading, error, notice, toUserId, setToUserId, busy, doReassign, doUndo } = state;
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!selected)
    return (
      <Panel className="flex min-h-[360px] items-center justify-center">
        <p className="max-w-xs text-center text-sm text-muted-foreground">
          Select a customer from the list to see who owns it and reassign.
        </p>
      </Panel>
    );
  if (loading && !preview) return <ReassignDetailSkeleton />;
  if (!preview)
    return <Panel><div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div></Panel>;

  const owner = preview.currentOwner;
  const targets = preview.salesExecutives.filter((se) => se.id !== owner?.id);
  const toName = targets.find((t) => t.id === toUserId)?.name ?? "";

  return (
    <section className="space-y-5 rounded-xl border border-border bg-card p-5 shadow-sm">
      {notice && <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">{notice}</div>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="flex items-start gap-3">
        <ReassignAvatar id={preview.customer.id} name={preview.customer.legalName} className="size-12 text-base" />
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-card-foreground">{preview.customer.legalName}</h2>
          {preview.customer.customerCode && <div className="font-mono text-xs text-muted-foreground">{preview.customer.customerCode}</div>}
        </div>
        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">{totalCount(preview.counts)} records</span>
      </div>

      {owner ? (
        <>
          <ReassignMove owner={owner} targets={targets} toUserId={toUserId} setToUserId={setToUserId} counts={preview.counts} busy={busy} onMove={() => setConfirmOpen(true)}>
            <ReassignWhatMoves counts={preview.counts} />
          </ReassignMove>
          <ReassignConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            customerName={preview.customer.legalName}
            fromName={owner.name}
            toName={toName}
            counts={preview.counts}
            busy={busy}
            onConfirm={async () => {
              await doReassign();
              setConfirmOpen(false);
            }}
          />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">This customer has no current owner. Assign a sales executive to it from the customer page first.</p>
      )}

      <ReassignHistory preview={preview} busy={busy} onUndo={doUndo} />
    </section>
  );
}
