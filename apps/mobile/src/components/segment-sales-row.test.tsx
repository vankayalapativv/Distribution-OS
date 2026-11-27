import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SegmentRow } from "./segment-sales-row";
import { SEGMENTS, type RankedSegmentRow, type SegmentLitres } from "../lib/segment-sales";

const litres = (): SegmentLitres =>
  Object.fromEntries(SEGMENTS.map((s) => [s, 0])) as SegmentLitres;

function row(partial: Partial<RankedSegmentRow> & { rank: number }): RankedSegmentRow {
  return {
    userId: "u1",
    name: "Asha",
    total: 10,
    bySegment: { ...litres(), Car: 7, "2W": 3 },
    ...partial,
  };
}

describe("SegmentRow", () => {
  it("renders a top-rank row with an integer litres label and a stacked bar", () => {
    render(<SegmentRow row={row({ rank: 1 })} first expanded={false} onToggle={() => {}} />);
    expect(screen.getByText("Asha")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument(); // rank badge
    expect(screen.getByText("10 L")).toBeInTheDocument();
    expect(screen.getByText("▸")).toBeInTheDocument(); // collapsed caret
  });

  it("uses the fallback rank badge beyond the top three and a decimal label", () => {
    render(
      <SegmentRow
        row={row({ rank: 5, total: 12.5, bySegment: { ...litres(), Car: 12.5 } })}
        first={false}
        expanded={false}
        onToggle={() => {}}
      />,
    );
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("12.5 L")).toBeInTheDocument();
  });

  it("shows the per-segment breakdown when expanded", () => {
    render(<SegmentRow row={row({ rank: 1 })} first expanded onToggle={() => {}} />);
    expect(screen.getByText("▾")).toBeInTheDocument();
    expect(screen.getByText("Car")).toBeInTheDocument();
    expect(screen.getByText("2W")).toBeInTheDocument();
  });

  it("guards a zero-total row (no divide-by-zero in the bars)", () => {
    render(
      <SegmentRow
        row={row({ rank: 1, total: 0, bySegment: litres() })}
        first
        expanded
        onToggle={() => {}}
      />,
    );
    expect(screen.getAllByText("0 L").length).toBeGreaterThan(0);
  });

  it("fires onToggle when pressed", () => {
    const onToggle = vi.fn();
    render(<SegmentRow row={row({ rank: 1 })} first expanded={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByText("Asha"));
    expect(onToggle).toHaveBeenCalled();
  });
});
