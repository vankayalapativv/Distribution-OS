import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/orders/search-select", () => ({
  SearchSelect: (p: {
    placeholder: string;
    onSelect: (v: string) => void;
    items: { id: string; name: string }[];
    getKey: (x: { id: string }) => string;
    getLabel: (x: { name: string }) => string;
  }) => (
    <select aria-label={p.placeholder} onChange={(e) => p.onSelect(e.target.value)}>
      {p.items.map((i) => (
        <option key={p.getKey(i)} value={p.getKey(i)}>
          {p.getLabel(i)}
        </option>
      ))}
    </select>
  ),
}));
import { CustomersFilterBar } from "./customers-filter-bar";

const base = {
  search: "",
  setSearch: vi.fn(),
  cities: ["Hyderabad"],
  salesExecutives: [{ id: "u1", name: "Ravi" }],
  filterCity: "",
  filterSalesExec: "",
  filterDues: "",
  setFilter: vi.fn(),
  onDownload: vi.fn(),
  downloadDisabled: false,
  downloading: false,
};

describe("CustomersFilterBar", () => {
  it("edits search, sets filters, and downloads from the kebab menu", () => {
    const setSearch = vi.fn();
    const setFilter = vi.fn();
    const onDownload = vi.fn();
    render(<CustomersFilterBar {...base} setSearch={setSearch} setFilter={setFilter} onDownload={onDownload} />);

    fireEvent.change(screen.getByPlaceholderText(/Search by name/), { target: { value: "raj" } });
    expect(setSearch).toHaveBeenCalledWith("raj");

    fireEvent.change(screen.getByLabelText("All cities"), { target: { value: "Hyderabad" } });
    expect(setFilter).toHaveBeenCalledWith("city", "Hyderabad");
    fireEvent.change(screen.getByLabelText("All executives"), { target: { value: "u1" } });
    expect(setFilter).toHaveBeenCalledWith("salesExecutiveId", "u1");
    fireEvent.change(screen.getByLabelText("All dues"), { target: { value: "owes" } });
    expect(setFilter).toHaveBeenCalledWith("dues", "owes");

    // Download is now behind the ⋮ kebab — no direct button.
    expect(screen.queryByRole("button", { name: /Download/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByTitle("Actions"));
    fireEvent.click(screen.getByRole("button", { name: /Download as PDF/ }));
    expect(onDownload).toHaveBeenCalled();
  });

  it("maps the 'all dues' sentinel back to an empty filter, and shows a busy label in the menu", () => {
    const setFilter = vi.fn();
    render(<CustomersFilterBar {...base} filterDues="owes" downloading setFilter={setFilter} />);
    fireEvent.change(screen.getByLabelText("All dues"), { target: { value: "__all" } });
    expect(setFilter).toHaveBeenCalledWith("dues", "");
    fireEvent.click(screen.getByTitle("Actions"));
    expect(screen.getByRole("button", { name: "Preparing…" })).toBeInTheDocument();
  });

  it("disables the download item when requested", () => {
    render(<CustomersFilterBar {...base} downloadDisabled />);
    fireEvent.click(screen.getByTitle("Actions"));
    expect(screen.getByRole("button", { name: /Download as PDF/ })).toBeDisabled();
  });
});
