"use client";

import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { type ActionConfig } from "@/lib/api-client";
import { CreditNoteDialog } from "@/features/collections/credit-note-dialog";
import { SalesReturnDialog } from "./sales-return-dialog";
import { LedgerEditCollectionDialog } from "./ledger-edit-collection-dialog";
import { LedgerEditReturnDialog } from "./ledger-edit-return-dialog";
import { OpeningBalanceDialog } from "./opening-balance-dialog";
import type { LedgerRole } from "./ledger-types";

export interface LedgerDialogsState {
  creditNoteOpen: boolean;
  setCreditNoteOpen: (o: boolean) => void;
  returnOpen: boolean;
  setReturnOpen: (o: boolean) => void;
  openingOpen: boolean;
  setOpeningOpen: (o: boolean) => void;
  editCollectionId: string | null;
  setEditCollectionId: (v: string | null) => void;
  editReturnId: string | null;
  setEditReturnId: (v: string | null) => void;
  proof: { url: string } | null;
  setProof: (v: { url: string } | null) => void;
}

/** Every ledger dialog: the receipt-image preview plus the credit-note, sales-
 *  return, entry-edit and opening-balance dialogs (each gated by role). */
export function LedgerDialogs({
  customerId,
  customerName,
  role,
  actionConfig,
  perms,
  state,
  onRefetch,
}: {
  readonly customerId: string;
  readonly customerName: string;
  readonly role: LedgerRole;
  readonly actionConfig: ActionConfig;
  readonly perms: { canCreateCreditNote: boolean; canCreateReturn: boolean; canEditEntries: boolean; canManageOpening: boolean };
  readonly state: LedgerDialogsState;
  readonly onRefetch: () => void;
}) {
  const s = state;
  return (
    <>
      <Dialog open={s.proof !== null} onOpenChange={() => s.setProof(null)}>
        <DialogContent size="xl">
          <DialogHeader>
            <DialogTitle>Payment receipt</DialogTitle>
          </DialogHeader>
          <DialogBody>
            {s.proof ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.proof.url} alt="Payment receipt" className="max-h-[75vh] w-full rounded-md object-contain" />
            ) : null}
          </DialogBody>
        </DialogContent>
      </Dialog>

      {perms.canCreateCreditNote && (
        <CreditNoteDialog open={s.creditNoteOpen} onOpenChange={s.setCreditNoteOpen} customerId={customerId} customerName={customerName} actionConfig={actionConfig} onCreated={onRefetch} />
      )}
      {perms.canCreateReturn && (
        <SalesReturnDialog open={s.returnOpen} onOpenChange={s.setReturnOpen} customerId={customerId} customerName={customerName} actionConfig={actionConfig} onCreated={onRefetch} />
      )}
      {perms.canEditEntries && (
        <LedgerEditCollectionDialog collectionId={s.editCollectionId} onOpenChange={(o) => { if (!o) s.setEditCollectionId(null); }} onSaved={onRefetch} actionConfig={actionConfig} />
      )}
      {perms.canEditEntries && (
        <LedgerEditReturnDialog returnId={s.editReturnId} onOpenChange={(o) => { if (!o) s.setEditReturnId(null); }} onSaved={onRefetch} actionConfig={actionConfig} />
      )}
      {perms.canManageOpening && (
        <OpeningBalanceDialog open={s.openingOpen} onOpenChange={s.setOpeningOpen} customerId={customerId} role={role} actionConfig={actionConfig} onChanged={onRefetch} />
      )}
    </>
  );
}
