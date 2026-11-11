"use client";

import { useState } from "react";
import { apiRequest, errorMessage, type ActionConfig } from "@/lib/api-client";
import { readDraft, useFormDraft } from "@/components/form/use-form-draft";
import type { CollectionDetail } from "./collections-types";

interface Options {
  open: boolean;
  collection: CollectionDetail;
  actionConfig: ActionConfig;
  onRejected: (updated: CollectionDetail) => void;
  onDone: () => void;
}

/** Reject-reason state + submission, with a persisted draft (never-drop-writes)
 *  so a failed reject or accidental close doesn't lose the typed reason. */
export function useCollectionReject({ open, collection, actionConfig, onRejected, onDone }: Options) {
  const draftKey = `collection-reject:${collection.id}`;
  const [remark, setRemark] = useState(() => readDraft<string>(draftKey) ?? "");
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);

  const draft = useFormDraft({ key: draftKey, value: remark, enabled: open, isEmpty: (v) => !v.trim() });

  async function handleReject() {
    if (!remark.trim()) return;
    setIsRejecting(true);
    setRejectError(null);
    try {
      // Reject returns the fully-enriched detail (incl. the rejecting user's name).
      const updated = await apiRequest<CollectionDetail>(
        actionConfig, "POST", `/collections/${collection.id}/reject`, { remark: remark.trim() },
      );
      draft.clear();
      setRemark("");
      onRejected(updated);
      onDone();
    } catch (error) {
      setRejectError(errorMessage(error, "Failed to reject."));
    } finally {
      setIsRejecting(false);
    }
  }

  return { remark, setRemark, isRejecting, rejectError, setRejectError, handleReject };
}
