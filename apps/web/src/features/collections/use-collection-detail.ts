"use client";

import { useState } from "react";
import { apiRequest, errorMessage, type ActionConfig } from "@/lib/api-client";
import type { CollectionDetail } from "./collections-types";

/** Detail-page state: the (locally-updated) collection plus the verify action.
 *  Rejection is handled by the reject dialog, which updates via `setCollection`. */
export function useCollectionDetail(initial: CollectionDetail, actionConfig: ActionConfig) {
  const [collection, setCollection] = useState(initial);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);

  async function handleVerify() {
    setIsVerifying(true);
    setVerifyError(null);
    try {
      // The verify endpoint returns the fully-enriched detail (names + fresh
      // post-reconcile allocations), so use it directly.
      const updated = await apiRequest<CollectionDetail>(actionConfig, "POST", `/collections/${collection.id}/verify`);
      setCollection(updated);
    } catch (error) {
      setVerifyError(errorMessage(error, "Failed to verify."));
    } finally {
      setIsVerifying(false);
    }
  }

  return {
    collection, setCollection, isVerifying, verifyError, rejectOpen, setRejectOpen, handleVerify,
    isPending: collection.accountantApprovalStatus === "pending",
  };
}
