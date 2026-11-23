import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReassignCustomerRow } from "./reassign-api";

vi.mock("./reassign-list-row", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ReassignListRow: (p: any) => <button onClick={p.onSelect}>{`row:${p.customer.legalName}:${p.selected}`}</button>,
}));
vi.mock("@/features/orders/search-select", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SearchSelect: (p: any) => (
    <div>{p.items.map((o: unknown) => <button key={p.getKey(o)} onClick={() => p.onSelect(p.getKey(o))}>{`own:${p.getLabel(o)}`}</button>)}</div>
  ),
}));

import { ReassignList } from "./reassign-list";

const c = (id: string, name: string): ReassignCustomerRow => ({
  id, legalName: name, customerCode: null, city: null, owner: { id: "o1", name: "Priya" }, recordCount: 1,
});
const base = {
  customers: [c("c1", "Alpha"), c("c2", "Beta")],
  total: 2,
  selectedId: "c1",
  onSelect: vi.fn(),
  search: "",
  setSearch: vi.fn(),
  owners: [{ id: "o1", name: "Priya" }],
  owner: "",
  setOwner: vi.fn(),
};

describe("ReassignList", () => {
  it("renders rows, the total count, and edits the search box", () => {
    const setSearch = vi.fn();
    render(<ReassignList {...base} setSearch={setSearch} />);
    expect(screen.getByText("row:Alpha:true")).toBeInTheDocument();
    expect(screen.getByText("row:Beta:false")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/Search name/), { target: { value: "x" } });
    expect(setSearch).toHaveBeenCalledWith("x");
    fireEvent.click(screen.getByText("row:Alpha:true"));
    expect(base.onSelect).toHaveBeenCalledWith("c1");
  });

  it("maps a real owner to the filter and the 'All owners' sentinel to empty", () => {
    const setOwner = vi.fn();
    render(<ReassignList {...base} setOwner={setOwner} />);
    fireEvent.click(screen.getByText("own:Priya"));
    expect(setOwner).toHaveBeenCalledWith("o1");
    fireEvent.click(screen.getByText("own:All owners"));
    expect(setOwner).toHaveBeenCalledWith("");
  });

  it("shows 'x of y' when filtered, and an empty state with no rows", () => {
    const { rerender } = render(<ReassignList {...base} customers={[c("c1", "Alpha")]} total={2} />);
    expect(screen.getByText("1 of 2")).toBeInTheDocument();
    rerender(<ReassignList {...base} customers={[]} total={2} />);
    expect(screen.getByText(/No customers match/)).toBeInTheDocument();
  });
});
