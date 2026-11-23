"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiRequest, errorMessage, type ActionConfig } from "@/lib/api-client";
import { totalCount } from "./reassign-logic";
import type { ReassignHistoryEntry, ReassignPreview } from "./reassign-api";

const KEY = "reassign-preview";

/** The selected customer's reassignment preview (TanStack Query) + the reassign /
 *  undo actions, which re-pull the preview on success. No fetch-in-effect. */
export function useReassign(actionConfig: ActionConfig, customerId: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: [KEY, customerId],
    queryFn: () => apiGet<ReassignPreview>(actionConfig, `/customers/${customerId}/reassign/preview`),
    enabled: Boolean(customerId),
  });
  const preview = query.data ?? null;

  const [toUserId, setToUserId] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Reset the per-customer transient state in render when the selection changes.
  const [prevId, setPrevId] = useState(customerId);
  if (customerId !== prevId) {
    setPrevId(customerId);
    setToUserId("");
    setNotice(null);
    setActionError(null);
  }

  const loading = query.isLoading;
  const error = actionError ?? (query.isError ? errorMessage(query.error, "Couldn't load this customer's reassignment details.") : null);

  async function run(action: () => Promise<ReassignHistoryEntry>, done: (e: ReassignHistoryEntry) => string, fail: string) {
    if (!preview) return;
    setBusy(true);
    setActionError(null);
    setNotice(null);
    try {
      const entry = await action();
      await queryClient.invalidateQueries({ queryKey: [KEY, preview.customer.id] });
      setToUserId("");
      setNotice(done(entry));
    } catch (e) {
      setActionError(errorMessage(e, fail));
    } finally {
      setBusy(false);
    }
  }

  const doReassign = () =>
    toUserId
      ? run(
          () => apiRequest<ReassignHistoryEntry>(actionConfig, "POST", `/customers/${preview!.customer.id}/reassign`, { toUserId }),
          (e) => `Reassigned to ${e.toUserName ?? "the selected executive"} — ${totalCount(e.counts)} record(s) moved.`,
          "Reassignment failed.",
        )
      : Promise.resolve();

  const doUndo = () =>
    run(
      () => apiRequest<ReassignHistoryEntry>(actionConfig, "POST", `/customers/${preview!.customer.id}/reassign/undo`),
      (e) => `Undone — customer returned to ${e.fromUserName ?? "the previous owner"}.`,
      "Undo failed.",
    );

  return { preview, loading, toUserId, setToUserId, busy, error, notice, doReassign, doUndo };
}
