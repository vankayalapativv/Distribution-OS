/* eslint-disable @typescript-eslint/no-explicit-any */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReassignPreview } from "./reassign-api";

vi.mock("./reassign-avatar", () => ({ ReassignAvatar: () => <span>AV</span> }));
vi.mock("./reassign-what-moves", () => ({ ReassignWhatMoves: () => <div>what-moves</div> }));
vi.mock("./reassign-history", () => ({ ReassignHistory: () => <div>history</div> }));
vi.mock("./reassign-move", () => ({
  ReassignMove: (p: any) => <div>move<button onClick={p.onMove}>open-confirm</button>{p.children}</div>,
}));
vi.mock("./reassign-confirm-dialog", () => ({
  ReassignConfirmDialog: (p: any) => (p.open ? <button onClick={p.onConfirm}>do-confirm</button> : null),
}));
vi.mock("./reassign-detail-skeleton", () => ({ ReassignDetailSkeleton: () => <div>detail-skeleton</div> }));

import { ReassignDetail } from "./reassign-detail";

const COUNTS = { orders: 2, collections: 0, invoices: 0, visits: 0, photos: 0, notes: 0, beatDays: 0 };
const preview = (owner: { id: string; name: string } | null): ReassignPreview => ({
  customer: { id: "c1", customerCode: "VD-c1", legalName: "Balaji" },
  currentOwner: owner, counts: COUNTS, undoable: null, history: [], salesExecutives: [{ id: "o2", name: "Vishnu" }],
});
const st = (over: Record<string, unknown> = {}) => ({
  preview: null, loading: false, error: null, notice: null, toUserId: "", setToUserId: vi.fn(),
  busy: false, doReassign: vi.fn().mockResolvedValue(undefined), doUndo: vi.fn(), ...over,
}) as any;

describe("ReassignDetail", () => {
  it("prompts to select when nothing is selected", () => {
    render(<ReassignDetail state={st()} selected={false} />);
    expect(screen.getByText(/Select a customer/)).toBeInTheDocument();
  });

  it("shows the context-aware skeleton while the preview loads, and the error when it fails", () => {
    const { rerender } = render(<ReassignDetail state={st({ loading: true })} selected />);
    expect(screen.getByText("detail-skeleton")).toBeInTheDocument();
    rerender(<ReassignDetail state={st({ error: "boom" })} selected />);
    expect(screen.getByText("boom")).toBeInTheDocument();
  });

  it("renders move + what-moves for an owned customer, shows a notice, and confirms a move", async () => {
    const doReassign = vi.fn().mockResolvedValue(undefined);
    render(<ReassignDetail state={st({ preview: preview({ id: "o1", name: "Priya" }), notice: "ok!", doReassign })} selected />);
    expect(screen.getByText("ok!")).toBeInTheDocument();
    expect(screen.getByText("move")).toBeInTheDocument();
    expect(screen.getByText("what-moves")).toBeInTheDocument();
    fireEvent.click(screen.getByText("open-confirm"));
    fireEvent.click(await screen.findByText("do-confirm"));
    expect(doReassign).toHaveBeenCalled();
  });

  it("shows the no-owner message (and an error banner) for an unowned customer", () => {
    render(<ReassignDetail state={st({ preview: preview(null), error: "e1" })} selected />);
    expect(screen.getByText(/no current owner/)).toBeInTheDocument();
    expect(screen.getByText("e1")).toBeInTheDocument();
    expect(screen.queryByText("move")).not.toBeInTheDocument();
  });
});
