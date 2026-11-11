"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DragEndEvent, DragOverEvent, DragStartEvent } from "@dnd-kit/core";
import type { BeatCustomer } from "./beat-plans-api";
import {
  build,
  computeDragOver,
  daysToPersist,
  findCol,
  reorderWithin,
  type ColId,
  type Items,
} from "./beat-board-logic";

export { DAY_COLS } from "./beat-board-logic";
export type { ColId } from "./beat-board-logic";

export interface BeatBoardCallbacks {
  /** Persist one weekday's exact order (drag reorder / move-in). */
  onReorderDay: (weekday: number, customerIds: string[]) => void;
  /** Remove a customer from every beat (dragged to / dropped on the pool). */
  onUnassign: (customerId: string) => void;
}

/** Owns the optimistic column state + all @dnd-kit handlers for the beat board.
 *  Re-syncs from the server list whenever it changes and no drag is active. */
export function useBeatBoard(customers: BeatCustomer[], cb: BeatBoardCallbacks) {
  const byId = useMemo(() => new Map(customers.map((c) => [c.customerId, c])), [customers]);
  const [items, setItems] = useState<Items>(() => build(customers));
  const [activeId, setActiveId] = useState<string | null>(null);
  const sourceCol = useRef<ColId | null>(null);
  const dragging = useRef(false);

  // Resync ONLY when the server hands us genuinely new data (SE switch, +Add /
  // remove refetch). Guarded by `dragging` and keyed on `customers` alone — NOT
  // on drag state — so a drop never resyncs to the pre-write server list, which
  // is what snapped a moved card back to its old day before the write landed.
  useEffect(() => {
    if (!dragging.current) setItems(build(customers));
  }, [customers]);

  function onDragStart(e: DragStartEvent) {
    dragging.current = true;
    const id = String(e.active.id);
    setActiveId(id);
    sourceCol.current = findCol(items, id);
  }

  function onDragOver(e: DragOverEvent) {
    if (!e.over) return;
    setItems((prev) => computeDragOver(prev, String(e.active.id), String(e.over!.id)) ?? prev);
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    const source = sourceCol.current;
    dragging.current = false;
    setActiveId(null);
    sourceCol.current = null;
    const target = findCol(items, String(active.id));
    if (!over || !target || !source) return;

    const next = reorderWithin(items, target, String(active.id), String(over.id));
    if (next !== items) setItems(next);

    // Persist the day(s) that changed; pool membership is implied by absence.
    daysToPersist(source, target).forEach((col) => cb.onReorderDay(Number(col), next[col]));
    if (target === "pool") cb.onUnassign(String(active.id));
  }

  // Esc / dropped nowhere: revert the optimistic move back to the server truth.
  function onDragCancel() {
    dragging.current = false;
    setActiveId(null);
    sourceCol.current = null;
    setItems(build(customers));
  }

  return { items, byId, activeId, onDragStart, onDragOver, onDragEnd, onDragCancel };
}
