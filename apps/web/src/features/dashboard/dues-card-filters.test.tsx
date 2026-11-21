import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/orders/search-select", () => ({
  // Exercise the arrows the filters pass in: getKey/getLabel over the items + onSelect.
  SearchSelect: <T,>(p: {
    items: T[];
    getKey: (x: T) => string;
    getLabel: (x: T) => string;
    onSelect: (v: string) => void;
    placeholder: string;
  }) => (
    <button onClick={() => p.onSelect("picked")} data-count={p.items.map(p.getKey).length}>
      {p.placeholder}:{p.items.map(p.getLabel).join(",")}
    </button>
  ),
}));

import { DuesFilters } from "./dues-card-filters";

describe("DuesFilters", () => {
  it("renders the title + both selects and reports exec/city picks", () => {
    const onExec = vi.fn();
    const onCity = vi.fn();
    render(
      <DuesFilters
        executiveId=""
        city=""
        salesExecutives={[{ id: "e1", name: "Ravi" }]}
        cities={["Guntur"]}
        onExec={onExec}
        onCity={onCity}
      />,
    );
    expect(screen.getByText("Collection Dues")).toBeInTheDocument();
    // "All executives" is prepended, then the real exec — getLabel/getKey ran over both.
    fireEvent.click(screen.getByText(/All executives:/));
    expect(onExec).toHaveBeenCalledWith("picked");
    fireEvent.click(screen.getByText(/All cities:/));
    expect(onCity).toHaveBeenCalledWith("picked");
  });
});
