"use client";

import { type SyntheticEvent, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet, errorMessage, type ActionConfig } from "@/lib/api-client";
import {
  isOverCap,
  returnItems,
  returnTotal,
  seedReturn,
  validateReturn,
  type ReturnForEdit,
} from "./sales-return-edit-logic";

/** Load a sales return, seed the edit form, and PATCH it (multipart) on submit. */
export function useLedgerReturnEdit({
  returnId,
  actionConfig,
  onSaved,
  onOpenChange,
}: {
  returnId: string | null;
  actionConfig: ActionConfig;
  onSaved: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const open = returnId !== null;
  const { data, isLoading } = useQuery({
    queryKey: ["sales-return-edit", returnId],
    queryFn: () => apiGet<{ salesReturn: ReturnForEdit }>(actionConfig, `/sales-returns/${returnId}`),
    enabled: open,
  });
  const ret = data?.salesReturn;

  const [date, setDate] = useState("");
  const [qty, setQty] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const seedKey = ret ? ret.id : null;
  const [prevSeed, setPrevSeed] = useState<string | null>(null);
  if (seedKey && seedKey !== prevSeed) {
    setPrevSeed(seedKey);
    const s = seedReturn(ret!);
    setDate(s.date);
    setReason(s.reason);
    setQty(s.qty);
    setProofFile(null);
    setError(null);
  }
  if (!open && prevSeed !== null) setPrevSeed(null);

  const lines = useMemo(() => ret?.lines ?? [], [ret]);
  const available = ret?.availableOutstanding ?? 0;
  const total = useMemo(() => returnTotal(lines, qty), [lines, qty]);
  const overCap = isOverCap(total, available);

  async function handleSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const items = returnItems(lines, qty);
    const invalid = validateReturn(items.length, overCap);
    if (invalid) return setError(invalid);
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("returnDate", date);
      body.append("items", JSON.stringify(items));
      if (reason.trim()) body.append("reason", reason.trim());
      if (proofFile) body.append("file", proofFile);
      const res = await fetch(`${actionConfig.apiBaseUrl}/sales-returns/${returnId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${actionConfig.authToken}` },
        body,
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(d?.error?.message ?? "Failed to save the sales return.");
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err, "Failed to save the sales return."));
    } finally {
      setBusy(false);
    }
  }

  return {
    open, ret, isLoading, lines, available, total, overCap,
    date, setDate, qty, setQty, reason, setReason, proofFile, setProofFile,
    busy, error, handleSubmit,
  };
}
