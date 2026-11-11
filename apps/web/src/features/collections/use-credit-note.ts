"use client";

import { type SyntheticEvent, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiRequest, errorMessage, type ActionConfig } from "@/lib/api-client";
import type { Collection, Collector } from "./collections-types";
import { buildCreditNotePayload, creditNoteCanSubmit, emptyCreditNoteForm, type CreditNoteForm } from "./credit-note-payload";

export interface OutstandingInvoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  outstandingAmount: number;
}

interface Options {
  open: boolean;
  customerId: string;
  actionConfig: ActionConfig;
  onCreated?: () => void;
  onDone: () => void;
}

/** State + data + submission for the credit-note dialog. */
export function useCreditNote({ open, customerId, actionConfig, onCreated, onDone }: Options) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CreditNoteForm>(emptyCreditNoteForm);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientUuid = useRef<string | null>(null);
  const set = (patch: Partial<CreditNoteForm>) => setForm((p) => ({ ...p, ...patch }));

  const collectorsQ = useQuery({
    queryKey: ["collectors"], enabled: open,
    queryFn: () => apiGet<Collector[]>(actionConfig, "/collections/collectors"),
  });
  const invoicesQ = useQuery({
    queryKey: ["customer-outstanding-invoices", customerId], enabled: open && !!customerId,
    queryFn: () => apiGet<{ invoices: OutstandingInvoice[] }>(actionConfig, `/customers/${customerId}/invoices`),
  });

  function reset() {
    setForm(emptyCreditNoteForm());
    setProofFile(null);
    setError(null);
    clientUuid.current = null;
  }

  async function uploadProof(id: string) {
    const body = new FormData();
    body.append("photo", proofFile as File);
    const res = await fetch(`${actionConfig.apiBaseUrl}/collections/${id}/proof`, {
      method: "POST", headers: { Authorization: `Bearer ${actionConfig.authToken}` }, body,
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => null);
      throw new Error(detail?.error?.message ?? "Failed to upload the document.");
    }
  }

  async function handleCreate(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form.invoiceId) return setError("Select the invoice this credit note is against.");
    setBusy(true);
    setError(null);
    try {
      if (!clientUuid.current) clientUuid.current = crypto.randomUUID();
      const created = await apiRequest<Collection>(actionConfig, "POST", "/collections", buildCreditNotePayload(customerId, form, clientUuid.current));
      if (proofFile) await uploadProof(created.id);
      void queryClient.invalidateQueries({ queryKey: ["collections"] });
      onCreated?.();
      reset();
      onDone();
    } catch (err) {
      setError(errorMessage(err, "Failed to create the credit note."));
    } finally {
      setBusy(false);
    }
  }

  return {
    form, set, proofFile, setProofFile, busy, error, handleCreate, reset,
    collectors: collectorsQ.data ?? [], invoices: invoicesQ.data?.invoices ?? [],
    invoicesLoading: invoicesQ.isLoading, canSubmit: creditNoteCanSubmit(form),
  };
}
