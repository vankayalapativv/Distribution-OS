import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BeatCustomer } from "./beat-plans-api";

vi.mock("@dnd-kit/core", () => ({ useDroppable: () => ({ setNodeRef: vi.fn(), isOver: false }) }));
vi.mock("./beat-column-cards", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  BeatColumnCards: ({ customers }: any) => <div>cards:{customers.length}</div>,
}));
vi.mock("./beat-add-dialog", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  BeatAddDialog: ({ open, onAdd, onClose }: any) =>
    open ? <div><button onClick={() => onAdd("c1")}>add-dialog</button><button onClick={onClose}>close-dialog</button></div> : null,
}));

import { BeatColumn } from "./beat-column";

const cust = { customerId: "c1", legalName: "Acme" } as unknown as BeatCustomer;
const base = { weekday: 2, title: "Tuesday", dow: "Tue", customers: [cust], pool: [], disabled: false, onRemove: vi.fn(), onAdd: vi.fn() };

describe("BeatColumn", () => {
  it("shows the title, count and the cards", () => {
    render(<BeatColumn {...base} />);
    expect(screen.getByText("Tuesday")).toBeInTheDocument();
    expect(screen.getByText("Tue")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument(); // count badge
    expect(screen.getByText("cards:1")).toBeInTheDocument();
  });

  it("opens the add dialog and forwards the pick with this weekday", () => {
    const onAdd = vi.fn();
    render(<BeatColumn {...base} onAdd={onAdd} />);
    fireEvent.click(screen.getByRole("button", { name: "Add customer" }));
    fireEvent.click(screen.getByText("add-dialog"));
    expect(onAdd).toHaveBeenCalledWith("c1", 2);
  });

  it("disables the add button when disabled", () => {
    render(<BeatColumn {...base} disabled />);
    expect(screen.getByRole("button", { name: "Add customer" })).toBeDisabled();
  });

  it("closes the add dialog on its onClose", () => {
    render(<BeatColumn {...base} />);
    fireEvent.click(screen.getByRole("button", { name: "Add customer" }));
    fireEvent.click(screen.getByText("close-dialog"));
    expect(screen.queryByText("add-dialog")).not.toBeInTheDocument();
  });
});
