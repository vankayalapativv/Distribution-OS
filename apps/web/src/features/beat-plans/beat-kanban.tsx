"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { BeatCardView } from "./beat-card";
import { BeatColumn } from "./beat-column";
import { BeatPool } from "./beat-pool";
import { useBeatBoard, type BeatBoardCallbacks } from "./use-beat-board";
import { WEEKDAYS, type BeatCustomer } from "./beat-plans-api";

/** The drag-and-drop board: an Unassigned pool + Mon–Sat columns. Drag a card
 *  onto a day (or the pool), and reorder within a day to set the visit sequence. */
export function BeatKanban({
  customers,
  disabled,
  callbacks,
  onAssign,
  onRemove,
}: {
  readonly customers: BeatCustomer[];
  readonly disabled: boolean;
  readonly callbacks: BeatBoardCallbacks;
  readonly onAssign: (customerId: string, weekday: number) => void;
  readonly onRemove: (customerId: string) => void;
}) {
  const { items, byId, activeId, onDragStart, onDragOver, onDragEnd, onDragCancel } = useBeatBoard(
    customers,
    callbacks,
  );
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const active = activeId ? byId.get(activeId) : null;
  const resolve = (ids: string[]) =>
    ids.map((id) => byId.get(id)).filter((c): c is BeatCustomer => Boolean(c));

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      <div className="flex min-h-0 flex-1 items-stretch gap-3.5 overflow-x-auto pb-3">
        <BeatPool customers={resolve(items.pool)} />
        {WEEKDAYS.map((d) => (
          <BeatColumn
            key={d.value}
            weekday={d.value}
            title={d.full}
            dow={d.label}
            customers={resolve(items[String(d.value) as keyof typeof items])}
            pool={resolve(items.pool)}
            disabled={disabled}
            onRemove={onRemove}
            onAdd={onAssign}
          />
        ))}
      </div>
      <DragOverlay>
        {active ? <BeatCardView customer={active} seq={null} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
