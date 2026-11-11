"use client";

import { useState, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Shared confirmation dialog — replaces `window.confirm` so destructive
 * actions get an in-app, styled prompt instead of a browser popup.
 *
 * A destructive confirm leads with a warning badge, and the dismiss button is
 * labelled "Go back" by default so it never collides with a "Cancel …" confirm
 * action (pass `dismissLabel` for something clearer still, e.g. "Keep invoice").
 *
 * `onConfirm` may be async: the dialog shows a busy state while it runs,
 * surfaces a thrown error inline, and only closes on success. Pass
 * `confirmDisabled` to block the confirm until the caller's own validation
 * passes (e.g. a required reason field).
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  details,
  extra,
  confirmLabel = "Delete",
  dismissLabel = "Go back",
  destructive = true,
  confirmDisabled = false,
  onConfirm,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly description?: ReactNode;
  /** Optional block identifying exactly what is being acted on. */
  readonly details?: ReactNode;
  /** Optional interactive slot (e.g. a note field) rendered below the details. */
  readonly extra?: ReactNode;
  readonly confirmLabel?: string;
  /** Label for the non-destructive dismiss button (default "Go back"). */
  readonly dismissLabel?: string;
  readonly destructive?: boolean;
  /** Keep the confirm button disabled until the caller's validation passes. */
  readonly confirmDisabled?: boolean;
  readonly onConfirm: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        if (!next) setError(null);
        onOpenChange(next);
      }}
    >
      <DialogContent size="sm" initialFocus={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>

        {details || extra || error ? (
          <DialogBody className="space-y-4">
            {details ? (
              <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
                {details}
              </div>
            ) : null}
            {extra ? <div>{extra}</div> : null}
            {error ? (
              <p className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>{error}</span>
              </p>
            ) : null}
          </DialogBody>
        ) : (
          <DialogBody className="py-2" />
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {dismissLabel}
          </Button>
          <Button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={busy || confirmDisabled}
            variant={destructive ? "destructive" : "default"}
          >
            {busy ? "Working…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
