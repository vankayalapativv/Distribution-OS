import { describe, expect, test } from "vitest";
import { render } from "@testing-library/react";
import { Skeleton } from "./skeleton-block";

describe("Skeleton", () => {
  test("renders a shimmer block with the given dimensions", () => {
    const { container } = render(<Skeleton width={120} height={20} radius={8} />);
    const block = container.firstElementChild as HTMLElement;
    expect(block).toBeInTheDocument();
    expect(block).toHaveStyle({ width: "120px", height: "20px", borderTopLeftRadius: "8px" });
  });

  test("defaults to a full-width 14px block", () => {
    const { container } = render(<Skeleton />);
    const block = container.firstElementChild as HTMLElement;
    expect(block).toHaveStyle({ height: "14px" });
  });
});
