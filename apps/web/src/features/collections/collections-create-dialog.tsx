"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { type ActionConfig } from "@/lib/api-client";
import type { CustomerOption } from "@/features/customers/customer-search-select";
import type { Collector } from "./collections-types";
import { CollectionFormFields } from "./collections-form-fields";
import { useCollectionCreate } from "./use-collection-create";

export function CollectionsCreateDialog({
  open, onOpenChange, customers, collectors, actionConfig, initialCustomerId, lockedCustomerLabel, onCreated,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly customers: CustomerOption[];
  readonly collectors: Collector[];
  readonly actionConfig: ActionConfig;
  /** Fix the collection to one customer (e.g. from that customer's ledger). */
  readonly initialCustomerId?: string;
  readonly lockedCustomerLabel?: string;
  /** Fired after a successful record (in addition to invalidating collections). */
  readonly onCreated?: () => void;
}) {
  const c = useCollectionCreate({ open, actionConfig, initialCustomerId, onCreated, onDone: () => onOpenChange(false) });

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) c.setError(null); onOpenChange(next); }}>
      <DialogContent size="md">
        <form onSubmit={c.handleCreate} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>Record collection</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            {c.restored && (
              <div className="flex items-center justify-between gap-3 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
                <span className="text-foreground">Restored your unsaved entry. Re-attach the receipt to record it.</span>
                <button type="button" onClick={c.discardDraft} className="shrink-0 font-medium text-primary hover:underline">
                  Discard
                </button>
              </div>
            )}

            <CollectionFormFields
              form={c.form}
              setForm={c.setForm}
              customers={customers}
              collectors={collectors}
              proofFile={c.proofFile}
              onProofChange={c.setProofFile}
              actionConfig={actionConfig}
              lockedCustomerLabel={lockedCustomerLabel}
            />

            {c.error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {c.error} <span className="text-destructive/80">Your entry is kept — fix and record again.</span>
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={c.isCreating || !c.canSubmit}>
              {c.isCreating ? "Recording…" : "Record collection"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
