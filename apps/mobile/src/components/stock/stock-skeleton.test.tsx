import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { StockSkeleton } from "./stock-skeleton";

describe("StockSkeleton", () => {
  it("renders the placeholder rows", () => {
    const { container } = render(<StockSkeleton />);
    expect(container.querySelector("div")).not.toBeNull();
  });
});
