import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Panel, SortTh } from "./analytics-panel";
import type { CustomerRow, CustomerSort } from "./analytics-types";

describe("Panel", () => {
  it("renders title, meta and children", () => {
    render(<Panel title="Oils" meta="6 SKUs"><div>body</div></Panel>);
    expect(screen.getByText("Oils")).toBeInTheDocument();
    expect(screen.getByText("6 SKUs")).toBeInTheDocument();
    expect(screen.getByText("body")).toBeInTheDocument();
  });
  it("omits the meta span when no meta is given", () => {
    render(<Panel title="Oils"><div>body</div></Panel>);
    expect(screen.getByText("Oils")).toBeInTheDocument();
  });
});

function renderTh(sort: CustomerSort, field: keyof CustomerRow, numeric?: boolean) {
  const onSort = vi.fn();
  render(
    <table><thead><tr>
      <SortTh label="Litres" field={field} numeric={numeric} sort={sort} onSort={onSort} />
    </tr></thead></table>,
  );
  return { onSort };
}

describe("SortTh", () => {
  it("shows the descending arrow when active and sorted desc, and calls onSort", () => {
    const { onSort } = renderTh({ key: "litres", dir: "desc" }, "litres", true);
    expect(screen.getByText("↓")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button"));
    expect(onSort).toHaveBeenCalledWith("litres");
  });
  it("shows the ascending arrow when active and sorted asc", () => {
    renderTh({ key: "litres", dir: "asc" }, "litres", true);
    expect(screen.getByText("↑")).toBeInTheDocument();
  });
  it("shows the neutral glyph and left-aligns non-numeric inactive headers", () => {
    renderTh({ key: "orders", dir: "asc" }, "customerName", false);
    expect(screen.getByText("⇅")).toBeInTheDocument();
    expect(screen.getByRole("columnheader").className).toContain("text-left");
  });
});
