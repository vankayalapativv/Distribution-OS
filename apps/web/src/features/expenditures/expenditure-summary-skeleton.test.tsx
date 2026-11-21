import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ExpenditureSummarySkeleton } from "./expenditure-summary-skeleton";

describe("ExpenditureSummarySkeleton", () => {
  it("renders four stat-card frames, the breakdown card, and the treemap-shaped bars", () => {
    const { container } = render(<ExpenditureSummarySkeleton />);
    // Four stat cards + the breakdown card.
    expect(container.querySelectorAll(".rounded-lg").length).toBe(5);
    // Treemap tile placeholders + stat/header/key bars are all skeletons.
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(10);
  });
});
