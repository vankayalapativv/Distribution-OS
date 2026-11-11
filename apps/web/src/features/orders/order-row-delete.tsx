"use client";

import { Trash2 } from "lucide-react";

interface OrderRowDeleteProps {
  readonly onRemove: () => void;
  /** When false, render a spacer instead of the button (the last oil row can't be removed). */
  readonly canRemove?: boolean;
}

/** The trash-can delete control shared by every order line row. */
export function OrderRowDelete({ onRemove, canRemove = true }: OrderRowDeleteProps) {
  return (
    <div className="flex justify-center">
      {canRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          aria-label="Remove line"
        >
          <Trash2 size={14} />
        </button>
      ) : (
        <span className="w-6" />
      )}
    </div>
  );
}
