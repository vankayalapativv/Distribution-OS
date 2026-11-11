import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BeatCustomer } from "./beat-plans-api";

vi.mock("@dnd-kit/sortable", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SortableContext: ({ children }: any) => <div>{children}</div>,
  verticalListSortingStrategy: {},
}));
vi.mock("./beat-card", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  BeatSortableCard: ({ customer, seq, onRemove }: any) => (
    <div>card:{customer.legalName}:{seq}<button onClick={onRemove}>rm-{customer.customerId}</button></div>
  ),
}));

import { BeatColumnCards } from "./beat-column-cards";

const cust = (id: string, city: string | null): BeatCustomer => ({
  customerId: id, customerCode: id, legalName: id, tradeName: null, phone: null, city,
  segment: null, weekday: 1, sequenceNo: 0,
});

describe("BeatColumnCards", () => {
  it("shows an empty prompt when there are no stops", () => {
    render(<BeatColumnCards customers={[]} onRemove={vi.fn()} />);
    expect(screen.getByText("Drop customers here")).toBeInTheDocument();
  });

  it("numbers the stops in order and wires remove", () => {
    const onRemove = vi.fn();
    render(<BeatColumnCards customers={[cust("a", "Pune"), cust("b", "Pune")]} onRemove={onRemove} />);
    expect(screen.getByText("card:a:1")).toBeInTheDocument();
    expect(screen.getByText("card:b:2")).toBeInTheDocument();
    fireEvent.click(screen.getByText("rm-a"));
    expect(onRemove).toHaveBeenCalledWith("a");
  });

  it("shows city labels only when the day spans multiple cities", () => {
    const { rerender } = render(<BeatColumnCards customers={[cust("a", "Pune"), cust("b", "Pune")]} onRemove={vi.fn()} />);
    expect(screen.queryByText("Pune")).not.toBeInTheDocument(); // single city → no labels
    rerender(<BeatColumnCards customers={[cust("a", "Pune"), cust("b", "Mumbai")]} onRemove={vi.fn()} />);
    expect(screen.getByText("Pune")).toBeInTheDocument();
    expect(screen.getByText("Mumbai")).toBeInTheDocument();
  });
});
