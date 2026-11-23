import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/orders/search-select", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SearchSelect: (p: any) => (
    <div>{p.items.map((t: unknown) => <button key={p.getKey(t)} onClick={() => p.onSelect(p.getKey(t))}>{`pick:${p.getLabel(t)}`}</button>)}</div>
  ),
}));

import { ReassignMove } from "./reassign-move";

const COUNTS = { orders: 24, collections: 11, invoices: 23, visits: 38, photos: 9, notes: 5, beatDays: 2 };
const base = {
  owner: { id: "o1", name: "Priya Field" },
  targets: [{ id: "o2", name: "Vishnu Vardhan" }],
  toUserId: "",
  setToUserId: vi.fn(),
  counts: COUNTS,
  busy: false,
  onMove: vi.fn(),
};

describe("ReassignMove", () => {
  it("shows the owner, renders children, picks a target, and gates the Move button", () => {
    const setToUserId = vi.fn();
    const onMove = vi.fn();
    const { rerender } = render(
      <ReassignMove {...base} setToUserId={setToUserId} onMove={onMove}><div>what-moves</div></ReassignMove>,
    );
    expect(screen.getAllByText("Priya Field").length).toBeGreaterThan(0); // owner card + from→to bar
    expect(screen.getByText("what-moves")).toBeInTheDocument();
    // from → to line shows "…" until a target is chosen
    expect(screen.getByText(/· 112 records re-attributed/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("pick:Vishnu Vardhan"));
    expect(setToUserId).toHaveBeenCalledWith("o2");

    const moveBtn = screen.getByRole("button", { name: /Move records/ });
    expect(moveBtn).toBeDisabled(); // no toUserId yet
    rerender(<ReassignMove {...base} toUserId="o2" onMove={onMove}><div /></ReassignMove>);
    const enabled = screen.getByRole("button", { name: /Move records/ });
    expect(enabled).not.toBeDisabled();
    expect(screen.getByText("Vishnu Vardhan")).toBeInTheDocument(); // resolved to-name in the bar
    fireEvent.click(enabled);
    expect(onMove).toHaveBeenCalled();
  });
});
