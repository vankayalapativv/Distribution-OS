"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { BeatCardView } from "./beat-card-view";
import type { BeatCustomer } from "./beat-plans-api";

// Re-exported so existing imports (`./beat-card`) keep working after the split.
export { BeatCardView } from "./beat-card-view";

/** One sortable customer within a column. Whole card is the drag handle; the
 *  PointerSensor's activation distance keeps the ✕ button clickable. */
export function BeatSortableCard({
  customer,
  seq,
  onRemove,
}: {
  readonly customer: BeatCustomer;
  readonly seq: number | null;
  readonly onRemove?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: customer.customerId,
  });
  return (
    <BeatCardView
      customer={customer}
      seq={seq}
      onRemove={onRemove}
      dragging={isDragging}
      innerRef={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      attributes={attributes}
      listeners={listeners}
    />
  );
}
