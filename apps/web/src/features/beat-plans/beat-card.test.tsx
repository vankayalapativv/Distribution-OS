import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const useSortable = vi.fn();
vi.mock("@dnd-kit/sortable", () => ({ useSortable: () => useSortable() }));
vi.mock("./beat-card-view", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  BeatCardView: ({ customer, dragging }: any) => <div>view:{customer.legalName} dragging={String(dragging)}</div>,
}));

import { BeatSortableCard } from "./beat-card";
import type { BeatCustomer } from "./beat-plans-api";

const cust = { customerId: "1", legalName: "Acme" } as unknown as BeatCustomer;

describe("BeatSortableCard", () => {
  it("passes the sortable's dragging state into the card view", () => {
    useSortable.mockReturnValue({ attributes: {}, listeners: {}, setNodeRef: vi.fn(), transform: null, transition: undefined, isDragging: true });
    render(<BeatSortableCard customer={cust} seq={1} />);
    expect(screen.getByText("view:Acme dragging=true")).toBeInTheDocument();
  });
});
