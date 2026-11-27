"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";

/**
 * Shared "reverse this entry" confirm (Phase 5 void/reverse). An optional reason
 * is recorded on the audit log. Used for both a booked expenditure and a salary
 * run — the caller supplies the wording and the void call.
 */
export function VoidReasonDialog({
  open,
  title,
  description,
  confirmLabel = "Reverse",
  onOpenChange,
  onConfirm,
}: {
  readonly open: boolean;
  readonly title: string;
  readonly description: string;
  readonly confirmLabel?: string;
  readonly onOpenChange: (open: boolean) => void;
  readonly onConfirm: (reason: string | null) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [prev, setPrev] = useState(false);
  if (open !== prev) {
    setPrev(open);
    if (open) setReason("");
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      extra={
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Reason (optional)</span>
          <textarea
            aria-label="Reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          />
        </label>
      }
      onConfirm={() => onConfirm(reason.trim() || null)}
    />
  );
}
