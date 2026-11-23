"use client";

import { cn } from "@/lib/utils";

/** A compact on/off switch. `changed` draws a ring so unsaved edits stand out. */
export function PermissionSwitch({
  checked,
  changed,
  label,
  onToggle,
}: {
  readonly checked: boolean;
  readonly changed: boolean;
  readonly label: string;
  readonly onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        checked ? "bg-primary" : "bg-muted-foreground/30",
        changed && "ring-2 ring-primary/40 ring-offset-1 ring-offset-background",
      )}
    >
      <span
        className={cn(
          "inline-block size-4 rounded-full bg-background shadow-sm transition-transform",
          checked ? "translate-x-4" : "translate-x-0.5",
        )}
      />
    </button>
  );
}
