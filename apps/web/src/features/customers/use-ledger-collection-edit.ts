"use client";

import { type SyntheticEvent, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet, apiRequest, errorMessage, type ActionConfig } from "@/lib/api-client";
import {
  collectionEditPayload,
  seedFromCollection,
  validateCollectionEdit,
  type CollectionDetail,
} from "./ledger-edit-collection-logic";

/** Load a collection, seed the edit form once, and PATCH it on submit. */
export function useLedgerCollectionEdit({
  collectionId,
  actionConfig,
  onSaved,
  onOpenChange,
}: {
  collectionId: string | null;
  actionConfig: ActionConfig;
  onSaved: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const open = collectionId !== null;
  const { data, isLoading } = useQuery({
    queryKey: ["collection-detail", collectionId],
    queryFn: () => apiGet<CollectionDetail>(actionConfig, `/collections/${collectionId}`),
    enabled: open,
  });

  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [mode, setMode] = useState("cash");
  const [reference, setReference] = useState("");
  const [remark, setRemark] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Seed the form once per opened collection (setState-in-render guarded by a key).
  const seedKey = data ? data.id : null;
  const [prevSeed, setPrevSeed] = useState<string | null>(null);
  if (seedKey && seedKey !== prevSeed) {
    setPrevSeed(seedKey);
    const s = seedFromCollection(data!);
    setAmount(s.amount);
    setDate(s.date);
    setMode(s.mode);
    setReference(s.reference);
    setRemark(s.remark);
    setError(null);
  }
  if (!open && prevSeed !== null) setPrevSeed(null);

  const verified = data?.accountantApprovalStatus === "verified";

  async function handleSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const result = validateCollectionEdit(amount, date);
    if ("error" in result) return setError(result.error);
    setBusy(true);
    setError(null);
    try {
      await apiRequest(
        actionConfig,
        "PATCH",
        `/collections/${collectionId}`,
        collectionEditPayload({ amount, date, mode, reference, remark }, result.amount),
      );
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err, "Failed to save the entry."));
    } finally {
      setBusy(false);
    }
  }

  return {
    open, data, isLoading, verified, busy, error,
    amount, setAmount, date, setDate, mode, setMode, reference, setReference, remark, setRemark,
    handleSubmit,
  };
}
