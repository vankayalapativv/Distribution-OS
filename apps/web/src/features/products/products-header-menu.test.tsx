import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProductsHeaderMenu } from "./products-header-menu";

describe("ProductsHeaderMenu", () => {
  it("hides Bulk Import until the ⋮ menu is opened, then fires onImport", () => {
    const onImport = vi.fn();
    render(<ProductsHeaderMenu onImport={onImport} />);
    expect(screen.queryByText("Bulk Import")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTitle("More actions"));
    fireEvent.click(screen.getByText("Bulk Import"));
    expect(onImport).toHaveBeenCalledOnce();
    // menu closes on select
    expect(screen.queryByText("Bulk Import")).not.toBeInTheDocument();
  });
});
