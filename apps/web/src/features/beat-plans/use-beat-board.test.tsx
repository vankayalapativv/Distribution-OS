import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DragEndEvent, DragOverEvent, DragStartEvent } from "@dnd-kit/core";
import { useBeatBoard, type BeatBoardCallbacks } from "./use-beat-board";
import type { BeatCustomer } from "./beat-plans-api";

const cust = (id: string, weekday: number | null): BeatCustomer => ({
  customerId: id, customerCode: id, legalName: id, tradeName: null, phone: null, city: null,
  segment: null, weekday, sequenceNo: 0,
});
const start = (id: string) => ({ active: { id } }) as unknown as DragStartEvent;
const over = (a: string, o: string | null) => ({ active: { id: a }, over: o ? { id: o } : null }) as unknown as DragOverEvent;
const end = (a: string, o: string | null) => ({ active: { id: a }, over: o ? { id: o } : null }) as unknown as DragEndEvent;

const setup = (customers: BeatCustomer[], cb: Partial<BeatBoardCallbacks> = {}) => {
  const onReorderDay = vi.fn();
  const onUnassign = vi.fn();
  const r = renderHook(({ list }) => useBeatBoard(list, { onReorderDay, onUnassign, ...cb }), {
    initialProps: { list: customers },
  });
  return { ...r, onReorderDay, onUnassign };
};

describe("useBeatBoard", () => {
  it("builds initial columns and tracks the active card on drag start", () => {
    const { result } = setup([cust("a", 1), cust("b", null)]);
    expect(result.current.items["1"]).toEqual(["a"]);
    expect(result.current.items.pool).toEqual(["b"]);
    act(() => result.current.onDragStart(start("a")));
    expect(result.current.activeId).toBe("a");
  });

  it("moves a card across columns on drag over", () => {
    const { result } = setup([cust("a", 1), cust("x", 2)]);
    act(() => result.current.onDragStart(start("a")));
    act(() => result.current.onDragOver(over("a", "2")));
    expect(result.current.items["1"]).toEqual([]);
    expect(result.current.items["2"]).toEqual(["x", "a"]);
    // Over nothing is a no-op.
    act(() => result.current.onDragOver(over("a", null)));
    expect(result.current.items["2"]).toEqual(["x", "a"]);
  });

  it("persists both days of a cross-day move on drag end", () => {
    const { result, onReorderDay, onUnassign } = setup([cust("a", 1), cust("x", 2)]);
    act(() => result.current.onDragStart(start("a")));
    act(() => result.current.onDragOver(over("a", "2")));
    act(() => result.current.onDragEnd(end("a", "2")));
    expect(onReorderDay).toHaveBeenCalledWith(1, []);
    expect(onReorderDay).toHaveBeenCalledWith(2, ["x", "a"]);
    expect(onUnassign).not.toHaveBeenCalled();
    expect(result.current.activeId).toBeNull();
  });

  it("unassigns when a card is dropped on the pool", () => {
    const { result, onReorderDay, onUnassign } = setup([cust("a", 1)]);
    act(() => result.current.onDragStart(start("a")));
    act(() => result.current.onDragOver(over("a", "pool")));
    act(() => result.current.onDragEnd(end("a", "pool")));
    expect(onReorderDay).toHaveBeenCalledWith(1, []); // old day emptied
    expect(onUnassign).toHaveBeenCalledWith("a");
  });

  it("drag end with no drop target persists nothing", () => {
    const { result, onReorderDay } = setup([cust("a", 1)]);
    act(() => result.current.onDragStart(start("a")));
    act(() => result.current.onDragEnd(end("a", null)));
    expect(onReorderDay).not.toHaveBeenCalled();
  });

  it("drag over within the same column is a no-op; a same-spot drop still persists the day", () => {
    const { result, onReorderDay } = setup([cust("a", 1), cust("b", 1)]);
    act(() => result.current.onDragStart(start("a")));
    act(() => result.current.onDragOver(over("a", "b"))); // same column → unchanged
    expect(result.current.items["1"]).toEqual(["a", "b"]);
    act(() => result.current.onDragEnd(end("a", "a"))); // dropped on itself → no reorder
    expect(result.current.items["1"]).toEqual(["a", "b"]);
    expect(onReorderDay).toHaveBeenCalledWith(1, ["a", "b"]);
  });

  it("resyncs from new server data, but not mid-drag; cancel reverts", () => {
    const { result, rerender } = setup([cust("a", 1)]);
    // New server data while idle → rebuilds.
    rerender({ list: [cust("a", 2)] });
    expect(result.current.items["2"]).toEqual(["a"]);
    // Mid-drag, incoming server data must NOT snap the board back.
    act(() => result.current.onDragStart(start("a")));
    act(() => result.current.onDragOver(over("a", "3")));
    rerender({ list: [cust("a", 2)] });
    expect(result.current.items["3"]).toEqual(["a"]);
    // Cancel reverts to the (new) server truth.
    act(() => result.current.onDragCancel());
    expect(result.current.items["2"]).toEqual(["a"]);
    expect(result.current.activeId).toBeNull();
  });
});
