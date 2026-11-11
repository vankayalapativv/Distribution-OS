"use client";

import { type ActionConfig } from "@/lib/api-client";
import { LedgerToolbar } from "./ledger-toolbar";
import { LedgerTable } from "./ledger-table";
import { LedgerDialogs } from "./ledger-dialogs";
import { useLedgerView } from "./use-ledger-view";
import { useLedgerDialogState } from "./use-ledger-dialog-state";
import { ledgerPermissions, type LedgerRole } from "./ledger-types";

export type { LedgerData, LedgerRow } from "./ledger-types";
export { payoffLabel, balanceLabel } from "./ledger-types";

export function CustomerLedgerTab({
  customerId,
  customerName,
  role,
  actionConfig,
}: {
  readonly customerId: string;
  readonly customerName: string;
  readonly role: LedgerRole;
  readonly actionConfig: ActionConfig;
}) {
  const perms = ledgerPermissions(role);
  const v = useLedgerView(customerId, customerName, actionConfig);
  const d = useLedgerDialogState();
  const refetch = () => void v.query.refetch();

  return (
    <div className="flex flex-col gap-3">
      <LedgerToolbar
        customerId={customerId}
        customerName={customerName}
        actionConfig={actionConfig}
        range={{
          from: v.from,
          to: v.to,
          preset: v.preset,
          open: v.calOpen,
          onOpenChange: v.setCalOpen,
          onPreset: v.onPreset,
          onCalendar: v.onCalendar,
        }}
        actions={{
          canCreateOrder: perms.canCreateOrder,
          canCreateCollection: perms.canCreateCollection,
          canCreateReturn: perms.canCreateReturn,
          canCreateCreditNote: perms.canCreateCreditNote,
          canManageOpening: perms.canManageOpening,
          onReturn: () => d.setReturnOpen(true),
          onCreditNote: () => d.setCreditNoteOpen(true),
          onOpening: () => d.setOpeningOpen(true),
          onDownload: () => void v.downloadPdf(),
          downloadDisabled: !v.data || v.query.isLoading || v.downloading,
          downloading: v.downloading,
        }}
      />

      <LedgerTable
        data={v.data}
        showSkeleton={v.showSkeleton}
        empty={v.empty}
        canViewProof={perms.canViewProof}
        canEditEntries={perms.canEditEntries}
        handlers={{
          onOpenInvoice: (id) => void v.openInvoice(id),
          onOpenProof: (id) => void v.openProof(id),
          onOpenReturnProof: (id) => void v.openReturnProof(id),
          onEdit: d.onEdit,
        }}
      />

      <LedgerDialogs
        customerId={customerId}
        customerName={customerName}
        role={role}
        actionConfig={actionConfig}
        perms={perms}
        onRefetch={refetch}
        state={{ ...d, proof: v.proof, setProof: v.setProof }}
      />
    </div>
  );
}
