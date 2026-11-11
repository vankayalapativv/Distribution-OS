"use client";

import { type SyntheticEvent, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest, errorMessage, type ActionConfig } from "@/lib/api-client";
import { readDraft, useFormDraft } from "@/components/form/use-form-draft";
import type { Collection } from "./collections-types";
import { EMPTY_COLLECTION_FORM, type CollectionForm } from "./collection-form-types";
import { buildCollectionPayload, isCollectionDraftEmpty } from "./collection-payload";

interface Options {
  open: boolean;
  actionConfig: ActionConfig;
  initialCustomerId?: string;
  onCreated?: () => void;
  onDone: () => void;
}

/** All state + submission for the record-collection dialog: a persisted draft
 *  (never-drop-writes), idempotent create + required proof upload, and reset. */
export function useCollectionCreate({ open, actionConfig, initialCustomerId, onCreated, onDone }: Options) {
  const queryClient = useQueryClient();
  const draftKey = `collection-create:${initialCustomerId ?? "general"}`;
  // Read any persisted draft once (state, not a ref — reading a ref during render
  // is disallowed). Seeds the form and the "restored" banner.
  const [initialDraft] = useState(() => readDraft<CollectionForm>(draftKey));
  const [form, setForm] = useState<CollectionForm>(() => {
    const seed = initialDraft ?? { ...EMPTY_COLLECTION_FORM, customerId: initialCustomerId ?? "" };
    return initialCustomerId ? { ...seed, customerId: initialCustomerId } : seed;
  });
  const [restored, setRestored] = useState(initialDraft != null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientUuid = useRef<string | null>(null);

  const draft = useFormDraft({
    key: draftKey, value: form, enabled: open,
    isEmpty: (f) => isCollectionDraftEmpty(f, initialCustomerId),
  });

  function reset() {
    setForm({ ...EMPTY_COLLECTION_FORM, customerId: initialCustomerId ?? "", collectionDate: new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) });
    setProofFile(null);
    setError(null);
    setRestored(false);
    clientUuid.current = null;
  }
  function discardDraft() {
    draft.clear();
    reset();
  }

  async function uploadProof(collectionId: string) {
    const body = new FormData();
    body.append("photo", proofFile as File);
    const res = await fetch(`${actionConfig.apiBaseUrl}/collections/${collectionId}/proof`, {
      method: "POST", headers: { Authorization: `Bearer ${actionConfig.authToken}` }, body,
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => null);
      throw new Error(detail?.error?.message ?? "Failed to upload payment proof.");
    }
  }

  async function handleCreate(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!proofFile) return setError("Attach the payment proof to record this collection.");
    setIsCreating(true);
    setError(null);
    try {
      if (!clientUuid.current) clientUuid.current = crypto.randomUUID();
      const created = await apiRequest<Collection>(actionConfig, "POST", "/collections", buildCollectionPayload(form, clientUuid.current));
      await uploadProof(created.id);
      void queryClient.invalidateQueries({ queryKey: ["collections"] });
      draft.clear();
      onCreated?.();
      reset();
      onDone();
    } catch (err) {
      setError(errorMessage(err, "Failed to record collection."));
    } finally {
      setIsCreating(false);
    }
  }

  const canSubmit = !!form.customerId && !!form.collectedByUserId && !!form.collectionAmount && !!proofFile;
  return { form, setForm, proofFile, setProofFile, isCreating, error, setError, restored, discardDraft, handleCreate, canSubmit };
}
