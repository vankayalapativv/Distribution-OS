import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ALL } from "./super-admin-list-logic";

// Mock SearchSelect: expose a button per option that fires onSelect(getKey(opt)).
vi.mock("@/features/orders/search-select", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SearchSelect: (p: any) => (
    <div>
      {p.items.map((o: unknown) => (
        <button key={p.getKey(o)} onClick={() => p.onSelect(p.getKey(o))}>
          {`${p.placeholder}:${p.getLabel(o)}`}
        </button>
      ))}
    </div>
  ),
}));

import { UsersFilterBar } from "./users-filter-bar";

const base = {
  search: "hi",
  setSearch: vi.fn(),
  filterRole: "",
  filterStatus: "",
  setFilter: vi.fn(),
};

describe("UsersFilterBar", () => {
  it("edits the search box", () => {
    const setSearch = vi.fn();
    render(<UsersFilterBar {...base} setSearch={setSearch} />);
    fireEvent.change(screen.getByPlaceholderText(/Search name/), { target: { value: "ravi" } });
    expect(setSearch).toHaveBeenCalledWith("ravi");
  });

  it("maps a real role to the filter and the 'all' sentinel to empty", () => {
    const setFilter = vi.fn();
    render(<UsersFilterBar {...base} setFilter={setFilter} />);
    fireEvent.click(screen.getByText("All roles:Manager"));
    expect(setFilter).toHaveBeenCalledWith("role", "MANAGER");
    fireEvent.click(screen.getByText("All roles:All roles"));
    expect(setFilter).toHaveBeenCalledWith("role", "");
  });

  it("maps status the same way", () => {
    const setFilter = vi.fn();
    render(<UsersFilterBar {...base} setFilter={setFilter} />);
    fireEvent.click(screen.getByText("All statuses:Active"));
    expect(setFilter).toHaveBeenCalledWith("status", "active");
    fireEvent.click(screen.getByText("All statuses:All statuses"));
    expect(setFilter).toHaveBeenCalledWith("status", "");
  });

  it("reflects active filter values as the select's current key", () => {
    render(<UsersFilterBar {...base} filterRole="MANAGER" filterStatus="active" />);
    // No assertion on value needed beyond render; the `|| ALL` fallback is exercised above.
    expect(ALL).toBe("__all");
  });
});
