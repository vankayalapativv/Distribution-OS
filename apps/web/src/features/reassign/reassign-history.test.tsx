import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReassignHistory } from "./reassign-history";
import type { ReassignHistoryEntry, ReassignPreview } from "./reassign-api";

const COUNTS = { orders: 2, collections: 0, invoices: 0, visits: 0, photos: 0, notes: 0, beatDays: 0 };
const entry = (over: Partial<ReassignHistoryEntry> = {}): ReassignHistoryEntry => ({
  id: "ra1", fromUserId: "o1", fromUserName: "Priya", toUserId: "o2", toUserName: "Vishnu",
  assignedByName: "Admin", createdAt: "2026-11-12T10:00:00Z", undoneAt: null, counts: COUNTS, ...over,
});
const preview = (history: ReassignHistoryEntry[], undoableId: string | null): ReassignPreview => ({
  customer: { id: "c1", customerCode: null, legalName: "X" },
  currentOwner: null, counts: COUNTS,
  undoable: undoableId ? entry({ id: undoableId }) : null, history, salesExecutives: [],
});

describe("ReassignHistory", () => {
  it("renders nothing when there is no history", () => {
    const { container } = render(<ReassignHistory preview={preview([], null)} busy={false} onUndo={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the Undo button on the undoable entry and fires onUndo", () => {
    const onUndo = vi.fn();
    render(<ReassignHistory preview={preview([entry({ id: "ra1" })], "ra1")} busy={false} onUndo={onUndo} />);
    expect(screen.getByText("Priya")).toBeInTheDocument();
    expect(screen.getByText(/by Admin · 2 moved/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Undo/ }));
    expect(onUndo).toHaveBeenCalled();
  });

  it("shows 'Undone' for an undone entry and nothing for a non-undoable active one", () => {
    render(
      <ReassignHistory
        preview={preview([entry({ id: "ra2", undoneAt: "2026-11-13T00:00:00Z" }), entry({ id: "ra3", fromUserName: null, toUserName: null, fromUserId: null, toUserId: null, assignedByName: null })], null)}
        busy={false}
        onUndo={vi.fn()}
      />,
    );
    expect(screen.getByText("Undone")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Undo/ })).not.toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0); // null names render as —
  });
});
