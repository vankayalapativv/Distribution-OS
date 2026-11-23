import { COUNT_LABELS, totalCount } from "./reassign-logic";
import type { MovedCounts } from "./reassign-api";

/** The "what moves" grid — a tile per record type with its count. */
export function ReassignWhatMoves({ counts }: { readonly counts: MovedCounts }) {
  return (
    <div>
      <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        What moves ({totalCount(counts)})
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {COUNT_LABELS.map(({ key, label, dot }) => (
          <div key={key} className="rounded-xl border border-border bg-muted/40 p-3">
            <div className="text-xl font-bold tabular-nums text-card-foreground">{counts[key]}</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={`size-2 rounded-full ${dot}`} />
              {label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
