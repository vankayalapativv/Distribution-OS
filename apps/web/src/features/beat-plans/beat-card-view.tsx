"use client";

import type { CSSProperties, Ref } from "react";
import type { DraggableAttributes } from "@dnd-kit/core";
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";
import { GripVertical, X } from "lucide-react";
import { SegmentIcons } from "@/components/segment-icons";
import { cn } from "@/lib/utils";
import type { BeatCustomer } from "./beat-plans-api";

/** The visual card, shared by the in-column sortable item and the drag overlay.
 *  A numbered sequence badge on day columns (= route order), a grip on the pool. */
export function BeatCardView({
  customer,
  seq,
  onRemove,
  dragging,
  overlay,
  innerRef,
  style,
  attributes,
  listeners,
}: {
  readonly customer: BeatCustomer;
  readonly seq: number | null;
  readonly onRemove?: () => void;
  readonly dragging?: boolean;
  readonly overlay?: boolean;
  readonly innerRef?: Ref<HTMLDivElement>;
  readonly style?: CSSProperties;
  readonly attributes?: DraggableAttributes;
  readonly listeners?: SyntheticListenerMap;
}) {
  const meta = [customer.city, customer.customerCode].filter(Boolean).join(" · ");
  return (
    <div
      ref={innerRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "group relative flex touch-none items-start gap-2 rounded-lg border bg-card px-2.5 py-2 text-left shadow-sm transition-colors",
        "cursor-grab hover:border-primary/40 hover:shadow-md active:cursor-grabbing",
        overlay && "rotate-[1.5deg] border-primary shadow-lg",
        dragging && "opacity-40",
      )}
    >
      {seq != null ? (
        <span className="mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-md bg-accent text-[10.5px] font-bold tabular-nums text-accent-foreground">
          {seq}
        </span>
      ) : (
        <GripVertical className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/50" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[13px] font-semibold text-foreground">{customer.legalName}</span>
          <SegmentIcons segment={customer.segment} />
        </div>
        {meta ? <p className="truncate font-mono text-[11px] text-muted-foreground">{meta}</p> : null}
      </div>
      {onRemove ? (
        <button
          type="button"
          aria-label="Remove from beat"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onRemove}
          className="absolute right-1.5 top-1.5 grid size-[22px] place-items-center rounded-md text-muted-foreground opacity-0 transition-colors hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}
