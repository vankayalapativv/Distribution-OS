import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PackSheetOptions } from "./pack-sheet-options";

const product = (over: Record<string, unknown> = {}) =>
  ({ id: "p1", productName: "Shell Helix", segments: ["Car", "2W"], packSizes: [1, 5], unit: "litres", ...over }) as never;

const cbs = () => ({ onPack: vi.fn(), onSegment: vi.fn(), onRemoveLine: vi.fn() });

describe("PackSheetOptions", () => {
  it("renders heading, existing lines, pack chips + segment chips", () => {
    const c = cbs();
    render(
      <PackSheetOptions
        product={product()}
        lines={[{ packSizeLitres: 1, quantityUnits: 2 } as never, { packSizeLitres: null, quantityUnits: 3 } as never]}
        pack={1}
        segment="Car"
        {...c}
      />,
    );
    expect(screen.getByText("Shell Helix")).toBeInTheDocument();
    expect(screen.getByText(/2 × 1 L/)).toBeInTheDocument();
    expect(screen.getByText(/3 pcs/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("5 L")); // pick a pack size
    expect(c.onPack).toHaveBeenCalledWith(5);
    fireEvent.click(screen.getByText("2W")); // pick a segment
    expect(c.onSegment).toHaveBeenCalledWith("2W");
    fireEvent.click(screen.getAllByText("✕")[0]); // remove line 0
    expect(c.onRemoveLine).toHaveBeenCalledWith(0);
  });

  it("hides pack sizes for a piece-sold product and a single-segment product", () => {
    render(<PackSheetOptions product={product({ unit: "quantity", segments: ["Car"] })} lines={[]} pack={null} segment={null} {...cbs()} />);
    expect(screen.queryByText("Pack size")).not.toBeInTheDocument(); // quantity unit
    expect(screen.queryByText("Segment")).not.toBeInTheDocument(); // single segment
  });

  it("shows the no-pack-sizes note (incl. an undefined packSizes)", () => {
    const { rerender } = render(<PackSheetOptions product={product({ packSizes: [] })} lines={[]} pack={null} segment={null} {...cbs()} />);
    expect(screen.getByText(/No pack sizes set/)).toBeInTheDocument();
    rerender(<PackSheetOptions product={product({ packSizes: undefined })} lines={[]} pack={null} segment={null} {...cbs()} />);
    expect(screen.getByText(/No pack sizes set/)).toBeInTheDocument();
  });
});
