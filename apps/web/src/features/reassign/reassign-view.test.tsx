/* eslint-disable @typescript-eslint/no-explicit-any */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReassignCustomerRow } from "./reassign-api";

const setCustomerId = vi.fn();
vi.mock("@/components/data-table/query-provider", () => ({ withQueryClient: (C: any) => C }));
vi.mock("@/lib/use-url-state", () => ({ useUrlParam: () => ["c1", setCustomerId] }));
vi.mock("@/components/page-header", () => ({ PageHeader: (p: any) => <h1>{p.title}</h1> }));
const listState = { search: "", setSearch: vi.fn(), owner: "", setOwner: vi.fn(), owners: [], filtered: [{ id: "c1" }, { id: "c2" }] };
vi.mock("./use-reassign-list", () => ({ useReassignList: () => listState }));
vi.mock("./use-reassign", () => ({ useReassign: () => ({}) }));
vi.mock("./reassign-list", () => ({
  ReassignList: (p: any) => <button onClick={() => p.onSelect("c2")}>{`list:${p.customers.length}:${p.selectedId}:${p.total}`}</button>,
}));
vi.mock("./reassign-detail", () => ({ ReassignDetail: (p: any) => <div>{`detail:${p.selected}`}</div> }));

import { ReassignView } from "./reassign-view";

const cfg = { apiBaseUrl: "x", authToken: "t" };
const customers = [{ id: "c1" }, { id: "c2" }, { id: "c3" }] as ReassignCustomerRow[];

describe("ReassignView", () => {
  it("renders header + list + detail, passes list state, and wires selection", () => {
    render(<ReassignView customers={customers} actionConfig={cfg} />);
    expect(screen.getByRole("heading", { name: "Reassign Customers" })).toBeInTheDocument();
    expect(screen.getByText("list:2:c1:3")).toBeInTheDocument(); // filtered=2, selected c1, total 3
    expect(screen.getByText("detail:true")).toBeInTheDocument(); // customerId "c1" → selected
    fireEvent.click(screen.getByText(/^list:/));
    expect(setCustomerId).toHaveBeenCalledWith("c2");
  });
});
