"use client";

import { type SyntheticEvent, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet, errorMessage, type ActionConfig } from "@/lib/api-client";
import { isOverCap, returnItems, returnTotal, validateReturn } from "./sales-return-edit-logic";
import {
  createReturnFormData,
  todayIso,
  type OutstandingInvoice,
  type ReturnableResponse,
} from "./sales-return-create-logic";

/** State + queries + submit for the New-Sales-Return dialog. */
export function useSalesReturn({
  open,
  customerId,
  actionConfig,
  onCreated,
  onOpenChange,
}: {
  open: boolean;
  customerId: string;
  actionConfig: ActionConfig;
  onCreated?: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [invoiceId, setInvoiceId] = useState("");
  const [date, setDate] = useState(todayIso);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0); // bumped on reset so re-opening re-fetches

  const invoicesQ = useQuery({
    queryKey: ["customer-outstanding-invoices", customerId],
    queryFn: () => apiGet<{ invoices: OutstandingInvoice[] }>(actionConfig, `/customers/${customerId}/invoices`),
    enabled: open && !!customerId,
  });
  const returnableQ = useQuery({
    queryKey: ["invoice-returnable", invoiceId, nonce],
    queryFn: () => apiGet<ReturnableResponse>(actionConfig, `/invoices/${invoiceId}/returnable`),
    enabled: open && !!invoiceId,
  });
  const lines = useMemo(() => returnableQ.data?.lines ?? [], [returnableQ.data]);
  const outstanding = returnableQ.data?.invoice.outstandingAmount ?? 0;
  const total = useMemo(() => returnTotal(lines, qty), [lines, qty]);
  const overCap = isOverCap(total, outstanding);

  function reset() {
    setInvoiceId("");
    setDate(todayIso());
    setQty({});
    setReason("");
    setProofFile(null);
    setError(null);
    setNonce((n) => n + 1);
  }
  function pickInvoice(id: string) {
    setInvoiceId(id);
    setQty({});
    setError(null);
  }

  async function handleSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const items = returnItems(lines, qty);
    const invalid = validateReturn(items.length, overCap);
    if (invalid) return setError(invalid);
    setBusy(true);
    setError(null);
    try {
      const body = createReturnFormData({ customerId, invoiceId, date, items, reason, proofFile });
      const res = await fetch(`${actionConfig.apiBaseUrl}/sales-returns`, {
        method: "POST",
        headers: { Authorization: `Bearer ${actionConfig.authToken}` },
        body,
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(d?.error?.message ?? "Failed to record the sales return.");
      }
      onCreated?.();
      reset();
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err, "Failed to record the sales return."));
    } finally {
      setBusy(false);
    }
  }

  return {
    invoiceId, date, setDate, qty, setQty, reason, setReason, proofFile, setProofFile, busy, error,
    invoicesQ, returnableQ, lines, outstanding, total, overCap, reset, pickInvoice, handleSubmit,
  };
}
