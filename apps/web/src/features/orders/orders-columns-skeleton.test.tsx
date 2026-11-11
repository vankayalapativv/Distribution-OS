import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { orderSkeleton } from "./orders-columns-skeleton";

describe("orderSkeleton", () => {
  it("has one renderer per base column (Ordered · Invoiced · Code · Customer · Litres)", () => {
    expect(orderSkeleton).toHaveLength(5);
  });

  it("renders skeleton placeholders for every cell (incl. the stacked customer cell)", () => {
    const { container } = render(
      <div>
        {orderSkeleton.map((cell, i) => (
          <div key={i}>{cell()}</div>
        ))}
      </div>,
    );
    // 4 single cells + 5 in the customer stack (name + 2 glyphs + city + phone) = 9.
    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(9);
  });
});
