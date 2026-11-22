import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TargetsExecSkeleton } from "./targets-exec-skeleton";
import { OIL_SEGMENTS } from "./targets-api";

describe("TargetsExecSkeleton", () => {
  it("renders the requested number of rows, each mirroring the exec row layout", () => {
    const { container } = render(<TargetsExecSkeleton rows={2} />);
    // Two divided rows (name+button left, bar grid right).
    expect(container.querySelectorAll(".divide-y > div").length).toBe(2);
    // Per row: name + button (2) + per segment a label, value and bar (3 each) + oil-total line (1).
    const perRow = 2 + OIL_SEGMENTS.length * 3 + 1;
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBe(perRow * 2);
  });

  it("defaults to 3 rows", () => {
    const { container } = render(<TargetsExecSkeleton />);
    expect(container.querySelectorAll(".divide-y > div").length).toBe(3);
  });
});
