"use client";

import { useState } from "react";
import type { LedgerRow } from "./ledger-types";

/** Open/edit state for the ledger's dialogs, plus the row → edit-dialog dispatch. */
export function useLedgerDialogState() {
  const [creditNoteOpen, setCreditNoteOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [openingOpen, setOpeningOpen] = useState(false);
  const [editCollectionId, setEditCollectionId] = useState<string | null>(null);
  const [editReturnId, setEditReturnId] = useState<string | null>(null);

  // Invoices are no longer edited from the ledger (generated invoices are edited
  // on their own page); only collections and sales returns are editable here.
  const onEdit = (r: LedgerRow) => {
    if (r.type === "Rcpt") setEditCollectionId(r.collectionId!);
    else setEditReturnId(r.returnId!);
  };

  return {
    creditNoteOpen, setCreditNoteOpen,
    returnOpen, setReturnOpen,
    openingOpen, setOpeningOpen,
    editCollectionId, setEditCollectionId,
    editReturnId, setEditReturnId,
    onEdit,
  };
}
