import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CatalogueHeader } from "./catalogue-header";
import { BrandTabs } from "./brand-tabs";

const base = {
  brands: ["Fuchs", "Savsol"],
  brand: "Fuchs",
  onBrand: vi.fn(),
  search: "oil",
  onSearch: vi.fn(),
  segments: ["Car", "2W"],
  segmentFilter: null as string | null,
  onSegment: vi.fn(),
  creditUnknown: false,
};

describe("BrandTabs", () => {
  it("renders nothing without brands", () => {
    const { container } = render(<BrandTabs brands={[]} brand={null} onBrand={() => {}} />);
    expect(container.textContent).toBe("");
  });
});

describe("CatalogueHeader", () => {
  it("searches/clears, switches brand and segment, and shows the credit warning", () => {
    const onSearch = vi.fn();
    const onBrand = vi.fn();
    const onSegment = vi.fn();
    render(<CatalogueHeader {...base} creditUnknown onSearch={onSearch} onBrand={onBrand} onSegment={onSegment} />);
    expect(screen.getByText(/Credit status unavailable/)).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Search products"), { target: { value: "shell" } });
    expect(onSearch).toHaveBeenCalledWith("shell");
    fireEvent.click(screen.getByText("✕")); // clear
    expect(onSearch).toHaveBeenCalledWith("");
    fireEvent.click(screen.getByText("Savsol")); // brand tab
    expect(onBrand).toHaveBeenCalledWith("Savsol");
    fireEvent.click(screen.getByText("Car")); // segment chip (select)
    expect(onSegment).toHaveBeenCalledWith("Car");
  });

  it("toggles an active segment off, and hides the credit warning when known", () => {
    const onSegment = vi.fn();
    render(<CatalogueHeader {...base} search="" segmentFilter="Car" onSegment={onSegment} />);
    expect(screen.queryByText(/Credit status unavailable/)).not.toBeInTheDocument();
    expect(screen.queryByText("✕")).not.toBeInTheDocument(); // empty search → no clear
    fireEvent.click(screen.getByText("Car")); // already active → clears
    expect(onSegment).toHaveBeenCalledWith(null);
    fireEvent.click(screen.getByText("All"));
    expect(onSegment).toHaveBeenCalledWith(null);
  });

  it("omits the segment row when there are no segments", () => {
    render(<CatalogueHeader {...base} segments={[]} />);
    expect(screen.queryByText("All")).not.toBeInTheDocument();
  });
});
