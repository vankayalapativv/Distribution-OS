"use client";

import { Button } from "@/components/ui/button";
import { DialogBody, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { type ActionConfig } from "@/lib/api-client";
import type { CustomerDetailRole } from "./customer-detail";
import { OpeningBalanceFields } from "./opening-balance-fields";
import { useOpeningForm } from "./use-opening-form";
import type { OpeningBalance } from "./opening-balance-logic";

function submitLabel(busy: boolean, initial: unknown): string {
  if (busy) return "Saving…";
  return initial ? "Save changes" : "Set opening balance";
}

export function OpeningForm({
  customerId,
  role,
  actionConfig,
  initial,
  onDone,
  onCancel,
}: {
  readonly customerId: string;
  readonly role: CustomerDetailRole;
  readonly actionConfig: ActionConfig;
  readonly initial: OpeningBalance | null;
  readonly onDone: () => void;
  readonly onCancel: () => void;
}) {
  const f = useOpeningForm({ customerId, role, actionConfig, initial, onDone });

  return (
    <form onSubmit={f.handleSubmit} className="flex min-h-0 flex-1 flex-col">
      <DialogHeader>
        <DialogTitle>Opening balance</DialogTitle>
      </DialogHeader>
      <DialogBody className="space-y-4">
        <OpeningBalanceFields
          initial={initial}
          locked={f.locked}
          busy={f.busy}
          amount={f.amount}
          setAmount={f.setAmount}
          asOfDate={f.asOfDate}
          setAsOfDate={f.setAsOfDate}
          remarks={f.remarks}
          setRemarks={f.setRemarks}
        />
        {f.error ? (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{f.error}</p>
        ) : null}
      </DialogBody>

      <DialogFooter>
        {f.canClear ? (
          <Button type="button" variant="outline" className="mr-auto text-destructive" disabled={f.busy} onClick={f.handleClear}>
            Clear
          </Button>
        ) : null}
        <Button type="button" variant="outline" onClick={onCancel} disabled={f.busy}>
          Cancel
        </Button>
        {!f.locked ? (
          <Button type="submit" disabled={f.busy}>
            {submitLabel(f.busy, initial)}
          </Button>
        ) : null}
      </DialogFooter>
    </form>
  );
}
