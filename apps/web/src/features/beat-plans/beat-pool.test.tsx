import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BeatCustomer } from "./beat-plans-api";

vi.mock("@dnd-kit/core", () => ({ useDroppable: () => ({ setNodeRef: vi.fn(), isOver: false }) }));
vi.mock("@dnd-kit/sortable", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SortableContext: ({ children }: any) => <div>{children}</div>,
  verticalListSortingStrategy: {},
}));
vi.mock("./beat-card", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  BeatSortableCard: ({ customer }: any) => <div>card:{customer.legalName}</div>,
}));

import { BeatPool } from "./beat-pool";

const cust = (id: string, name: string): BeatCustomer => ({
  customerId: id, customerCode: id, legalName: name, tradeName: null, phone: null, city: "Pune",
  segment: null, weekday: null, sequenceNo: 0,
});

describe("BeatPool", () => {
  it("lists unassigned customers and the header count", () => {
    render(<BeatPool customers={[cust("a", "Acme"), cust("b", "Beta")]} />);
    expect(screen.getByText("Unassigned")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("card:Acme")).toBeInTheDocument();
  });

  it("filters by the search box and shows a no-matches message", () => {
    render(<BeatPool customers={[cust("a", "Acme"), cust("b", "Beta")]} />);
    fireEvent.change(screen.getByPlaceholderText(/Search name/), { target: { value: "acme" } });
    expect(screen.getByText("card:Acme")).toBeInTheDocument();
    expect(screen.queryByText("card:Beta")).not.toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/Search name/), { target: { value: "zzz" } });
    expect(screen.getByText("No matches")).toBeInTheDocument();
  });

  it("shows the all-assigned message when empty", () => {
    render(<BeatPool customers={[]} />);
    expect(screen.getByText("All customers assigned")).toBeInTheDocument();
  });
});
