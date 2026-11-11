import { arrayMove } from "@dnd-kit/sortable";
import type { BeatCustomer } from "./beat-plans-api";

/** Column ids: the unassigned pool, then weekdays 1(Mon)…6(Sat) as strings. */
export type ColId = "pool" | "1" | "2" | "3" | "4" | "5" | "6";
export const DAY_COLS: ColId[] = ["1", "2", "3", "4", "5", "6"];
export const ALL_COLS: ColId[] = ["pool", ...DAY_COLS];

export type Items = Record<ColId, string[]>;

/** Group customer ids into columns by weekday (null → pool), preserving order. */
export function build(customers: BeatCustomer[]): Items {
  const items: Items = { pool: [], "1": [], "2": [], "3": [], "4": [], "5": [], "6": [] };
  for (const c of customers) {
    const col: ColId = c.weekday == null ? "pool" : (String(c.weekday) as ColId);
    items[col].push(c.customerId);
  }
  return items;
}

/** The column an id belongs to — a column id itself, or the column holding it. */
export function findCol(items: Items, id: string): ColId | null {
  if ((ALL_COLS as string[]).includes(id)) return id as ColId;
  return ALL_COLS.find((k) => items[k].includes(id)) ?? null;
}

/** Live cross-column move (onDragOver). Returns the new items, or null when the
 *  card is over its own column (no change) or the ids don't resolve. */
export function computeDragOver(prev: Items, activeId: string, overId: string): Items | null {
  const activeC = findCol(prev, activeId);
  const overC = findCol(prev, overId);
  if (!activeC || !overC || activeC === overC) return null;
  const from = prev[activeC].filter((i) => i !== activeId);
  const overItems = prev[overC];
  const overIndex = overId in prev ? overItems.length : overItems.indexOf(overId);
  const insertAt = overIndex < 0 ? overItems.length : overIndex;
  const to = [...overItems.slice(0, insertAt), activeId, ...overItems.slice(insertAt)];
  return { ...prev, [activeC]: from, [overC]: to };
}

/** Final in-column reorder (onDragEnd). Returns the reordered items, or the same
 *  reference when nothing moves. */
export function reorderWithin(items: Items, target: ColId, activeId: string, overId: string): Items {
  const list = items[target];
  const activeIndex = list.indexOf(activeId);
  const overIndex = overId in items ? list.length - 1 : list.indexOf(overId);
  if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
    return { ...items, [target]: arrayMove(list, activeIndex, overIndex) };
  }
  return items;
}

/** Which day columns changed and must be persisted (pool membership is implied). */
export function daysToPersist(source: ColId, target: ColId): ColId[] {
  const cols = new Set<ColId>();
  if (source !== "pool") cols.add(source);
  if (target !== "pool") cols.add(target);
  return [...cols];
}
