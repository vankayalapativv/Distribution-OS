import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { customerSkeleton } from "./customers-columns-skeleton";

describe("customerSkeleton", () => {
  it("has one cell renderer per customer column (Code · Name · Oldest · Dues · Status)", () => {
    expect(customerSkeleton).toHaveLength(5);
  });

  it("every cell renders skeleton placeholders (9 in total, incl. the name/meta stack)", () => {
    const { container } = render(
      <div>
        {customerSkeleton.map((cell, i) => (
          <div key={i}>{cell()}</div>
        ))}
      </div>,
    );
    // Cell 2 draws 5 (name + 2 segment glyphs + city + phone); the other 4 draw 1 each.
    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(9);
  });
});
