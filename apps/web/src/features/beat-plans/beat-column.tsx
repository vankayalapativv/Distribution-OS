"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { BeatColumnCards } from "./beat-column-cards";
import { BeatAddDialog } from "./beat-add-dialog";
import type { BeatCustomer } from "./beat-plans-api";

/** One weekday column: a droppable list of numbered stops (BeatColumnCards) plus
 *  the "+ Add customer" search dialog fallback. */
export function BeatColumn({
  weekday,
  title,
  dow,
  customers,
  pool,
  disabled,
  onRemove,
  onAdd,
}: {
  readonly weekday: number;
  readonly title: string;
  readonly dow: string;
  readonly customers: BeatCustomer[];
  readonly pool: BeatCustomer[];
  readonly disabled: boolean;
  readonly onRemove: (customerId: string) => void;
  readonly onAdd: (customerId: string, weekday: number) => void;
}) {
  const [adding, setAdding] = useState(false);
  const { setNodeRef, isOver } = useDroppable({ id: String(weekday) });

  return (
    <div
      className={cn(
        "flex h-full min-h-0 w-[288px] shrink-0 flex-col rounded-xl border border-border bg-card shadow-sm",
        isOver && "ring-2 ring-primary/40",
      )}
    >
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-foreground">{title}</span>
          <span className="text-[10px] font-medium text-muted-foreground">{dow}</span>
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
          {customers.length}
        </span>
      </header>

      <div ref={setNodeRef} className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2.5">
        <BeatColumnCards customers={customers} onRemove={onRemove} />
      </div>

      <div className="shrink-0 border-t border-border p-2.5">
        <button
          type="button"
          onClick={() => setAdding(true)}
          disabled={disabled}
          className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border text-xs font-medium text-muted-foreground transition-colors hover:border-transparent hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
        >
          <Plus className="size-3.5" /> Add customer
        </button>
      </div>

      <BeatAddDialog
        open={adding}
        onClose={() => setAdding(false)}
        dayLabel={title}
        pool={pool}
        disabled={disabled}
        onAdd={(id) => {
          onAdd(id, weekday);
          setAdding(false);
        }}
      />
    </div>
  );
}
