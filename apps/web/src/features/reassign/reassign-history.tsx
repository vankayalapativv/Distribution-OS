import { ArrowRight, RotateCcw } from "lucide-react";
import { formatDate } from "@/lib/format";
import { ReassignAvatar } from "./reassign-avatar";
import { totalCount } from "./reassign-logic";
import type { ReassignHistoryEntry, ReassignPreview } from "./reassign-api";

/** Reassignment history for the selected customer, with Undo on the latest entry. */
export function ReassignHistory({
  preview,
  busy,
  onUndo,
}: Readonly<{ preview: ReassignPreview; busy: boolean; onUndo: () => void }>) {
  if (preview.history.length === 0) return null;
  return (
    <div>
      <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        Reassignment history
      </div>
      <div className="space-y-2">
        {preview.history.map((h) => (
          <HistoryRow key={h.id} entry={h} undoable={preview.undoable?.id === h.id} busy={busy} onUndo={onUndo} />
        ))}
      </div>
    </div>
  );
}

function HistoryRow({
  entry,
  undoable,
  busy,
  onUndo,
}: Readonly<{ entry: ReassignHistoryEntry; undoable: boolean; busy: boolean; onUndo: () => void }>) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm">
      {entry.fromUserId && entry.fromUserName && <ReassignAvatar id={entry.fromUserId} name={entry.fromUserName} className="size-5 text-[9px]" />}
      <span className="text-card-foreground">{entry.fromUserName ?? "—"}</span>
      <ArrowRight className="size-3 shrink-0 text-muted-foreground" />
      {entry.toUserId && entry.toUserName && <ReassignAvatar id={entry.toUserId} name={entry.toUserName} className="size-5 text-[9px]" />}
      <span className="text-card-foreground">{entry.toUserName ?? "—"}</span>
      <span className="text-xs text-muted-foreground">
        · {formatDate(entry.createdAt)}
        {entry.assignedByName ? ` · by ${entry.assignedByName}` : ""} · {totalCount(entry.counts)} moved
      </span>
      <div className="ml-auto">
        {entry.undoneAt ? (
          <span className="text-xs text-muted-foreground">Undone</span>
        ) : undoable ? (
          <button
            type="button"
            disabled={busy}
            onClick={onUndo}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
          >
            <RotateCcw className="size-3" /> Undo
          </button>
        ) : null}
      </div>
    </div>
  );
}
