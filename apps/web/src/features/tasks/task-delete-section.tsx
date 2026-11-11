"use client";

import { Trash2 } from "lucide-react";

/** Creator-only delete affordance for a finished task, with a confirm step. */
export function TaskDeleteSection({
  confirming, setConfirming, deleting, onDelete,
}: {
  readonly confirming: boolean;
  readonly setConfirming: (v: boolean) => void;
  readonly deleting: boolean;
  readonly onDelete: () => void;
}) {
  return (
    <div className="mt-2 border-t border-border pt-4">
      {confirming ? (
        <div className="flex flex-col gap-2 rounded-md bg-red-50 p-3 ring-1 ring-red-600/20">
          <p className="text-sm font-medium text-red-700">Delete this task permanently?</p>
          <p className="text-xs text-red-600/80">Its comments and attachments will be removed too. This can’t be undone.</p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setConfirming(false)} disabled={deleting}
              className="rounded-md px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-accent">
              Cancel
            </button>
            <button onClick={onDelete} disabled={deleting}
              className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50">
              {deleting ? "Deleting…" : "Delete permanently"}
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setConfirming(true)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700">
          <Trash2 size={14} /> Delete task
        </button>
      )}
    </div>
  );
}
