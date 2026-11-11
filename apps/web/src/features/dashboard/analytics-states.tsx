"use client";

import { Inbox, type LucideIcon } from "lucide-react";

/**
 * Unified empty state for an analytics table — a muted icon + one explanatory
 * line, spanning the table. Replaces scattered bare "—"/"No data" cells so an
 * empty period reads as "nothing yet", not "broken".
 */
export function EmptyRow({
  colSpan,
  message,
  icon: Icon = Inbox,
}: {
  readonly colSpan: number;
  readonly message: string;
  readonly icon?: LucideIcon;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10">
        <div className="flex flex-col items-center gap-2 text-center">
          <Icon className="size-6 text-slate-400" aria-hidden="true" />
          <p className="max-w-xs text-sm text-muted-foreground">{message}</p>
        </div>
      </td>
    </tr>
  );
}

/** Error state for an analytics table — a spanning red-tinted row. */
export function ErrorRow({ colSpan, message }: { readonly colSpan: number; readonly message: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-8">
        <p className="text-center text-sm text-destructive">{message}</p>
      </td>
    </tr>
  );
}

/** Non-table variant of {@link EmptyRow} — same treatment inside a plain panel. */
export function EmptyBlock({ message, icon: Icon = Inbox }: { readonly message: string; readonly icon?: LucideIcon }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <Icon className="size-6 text-slate-400" aria-hidden="true" />
      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

/** Share bar + percentage. */
export function Share({ value, total }: { readonly value: number; readonly total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <span className="flex items-center justify-end gap-2">
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
        <span
          className="block h-full rounded-full bg-primary"
          style={{ width: `${Math.max(pct, value > 0 ? 3 : 0)}%` }}
        />
      </span>
      <span className={`w-9 text-right text-xs ${pct === 0 ? "text-slate-400" : "text-muted-foreground"}`}>
        {pct}%
      </span>
    </span>
  );
}
